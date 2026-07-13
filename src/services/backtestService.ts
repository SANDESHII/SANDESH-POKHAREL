
import fs from 'fs';
import path from 'path';
import { getTeamBaseline } from './baselineDataService';
import { MatchEngine } from './engine';
import { SignalFilter } from '../core/kalman';
import { IngestionService } from './ingestionService';
import { MatchContext, AnalysisResult } from '../types';

export interface HistoricalMatch {
    date: string;
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
    context: MatchContext;
    odds?: {
        over25: number;
        under25: number;
    };
}

export interface EdgeSegment {
    segment: string;
    count: number;
    hits: number;
    hitRate: number;
    avgEdge: number;
}

export interface BacktestSummary {
    totalMatches: number;
    over15Accuracy: number;
    under35Accuracy: number;
    averageConfidence: number;
    brierScore: number;
    highPurityBrierScore: number;
    highPurityMatches: number;
    calibrationBins: { bin: string; hitRate: number; expected: number; n: number }[];
    edgeSegments: EdgeSegment[];
    matches: Array<{
        match: HistoricalMatch;
        prediction: AnalysisResult;
        isOver15Correct: boolean;
        isUnder35Correct: boolean;
        marketEdge?: number;
    }>;
}

import { EdgeCalculator } from '../market/edgeCalculator';
import { DixonColes } from '../core/dixonColes';
import { LogisticEnsemble } from '../ensemble/secondModel';

export class BacktestService {
    private static parseCSV(csv: string): HistoricalMatch[] {
        const lines = csv.split('\n').filter(l => l.trim());
        const h = lines[0].split(',');
        const idx = { h: h.indexOf('HomeTeam'), a: h.indexOf('AwayTeam'), d: h.indexOf('Date'), hg: h.indexOf('FTHG'), ag: h.indexOf('FTAG'), div: h.indexOf('Div'), o25: h.indexOf('Avg>2.5'), u25: h.indexOf('Avg<2.5') };

        return lines.slice(1).map(line => {
            const p = line.split(','), dp = p[idx.d].split('/');
            return {
                date: `${dp[2]}-${dp[1]}-${dp[0]}`, homeTeam: p[idx.h], awayTeam: p[idx.a],
                actualScore: [parseInt(p[idx.hg]), parseInt(p[idx.ag])] as [number, number],
                league: p[idx.div] === 'E0' ? 'Premier League' : p[idx.div],
                context: { weather: "Clear", stakes: "STANDARD", marketSentiment: "Neutral", tacticalDrift: "STABLE" },
                odds: idx.o25 !== -1 ? { over25: parseFloat(p[idx.o25]), under25: parseFloat(p[idx.u25]) } : undefined
            };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    static async runBacktest(): Promise<BacktestSummary> {
        const csv = fs.readFileSync(path.join(process.cwd(), 'src/data/historical_pl_2324.csv'), 'utf8');
        const all = this.parseCSV(csv), samples = all.slice(0, 200);
        
        SignalFilter.setCollection('backtest_teamStates');
        await SignalFilter.reset();

        const avgs = new Map<string, { s: number, n: number }>();
        all.forEach(m => {
            [[m.homeTeam, m.actualScore[0]], [m.awayTeam, m.actualScore[1]]].forEach(([t, s]) => {
                const entry = avgs.get(t as string) || { s: 0, n: 0 };
                entry.s += s as number; entry.n++;
                avgs.set(t as string, entry);
            });
        });

        const rhoData = DixonColes.fitRho(all.map(m => ({ x: m.actualScore[0], y: m.actualScore[1], lambda: avgs.get(m.homeTeam)!.s / avgs.get(m.homeTeam)!.n, mu: avgs.get(m.awayTeam)!.s / avgs.get(m.awayTeam)!.n })));
        
        await LogisticEnsemble.train(all.slice(0, 100).map(m => ({
            home: IngestionService.standardize({ ...getTeamBaseline(m.homeTeam), name: m.homeTeam }, { adjustmentA: 1, adjustmentB: 1 }),
            away: IngestionService.standardize({ ...getTeamBaseline(m.awayTeam), name: m.awayTeam }, { adjustmentA: 1, adjustmentB: 1 }),
            context: m.context, isOver15: (m.actualScore[0] + m.actualScore[1]) > 1.5
        })));

        const results: BacktestSummary["matches"] = [], bins = Array.from({ length: 10 }, (_, i) => ({ min: i * 0.1, max: (i + 1) * 0.1, n: 0, h: 0, p: 0 }));
        const edges = [{ n: 'High', min: 0.05, max: 1, c: 0, h: 0, e: 0 }, { n: 'Mod', min: 0.02, max: 0.05, c: 0, h: 0, e: 0 }, { n: 'No', min: -1, max: 0.02, c: 0, h: 0, e: 0 }];
        let totalB = 0, hpB = 0, hpC = 0, ovC = 0, unC = 0, totalC = 0;

        for (const m of samples) {
            const hB = getTeamBaseline(m.homeTeam), aB = getTeamBaseline(m.awayTeam);
            const hS = await SignalFilter.get(m.homeTeam), aS = await SignalFilter.get(m.awayTeam);
            const hD = IngestionService.standardize({ ...hB, name: m.homeTeam, npxG: hS?.estimatedNpxG || hB.npxG, npxGVariance: hS?.variance || 0.5 }, { adjustmentA: 0.5, adjustmentB: 0.5 });
            const aD = IngestionService.standardize({ ...aB, name: m.awayTeam, npxG: aS?.estimatedNpxG || aB.npxG, npxGVariance: aS?.variance || 0.5 }, { adjustmentA: 0.5, adjustmentB: 0.5 });
            
            const math = MatchEngine.calculateMatchExpectancy(hD, aD, { ...m.context, date: m.date }, undefined, rhoData);
            const tg = m.actualScore[0] + m.actualScore[1], isO15 = tg > 1.5, isU35 = tg < 3.5, prob = math.probability / 100;
            const outcome = math.predictionType === 'OVER_15' ? isO15 : isU35;
            const brier = Math.pow(prob - (outcome ? 1 : 0), 2);

            let edge = 0;
            if (m.odds) {
                const matrix = DixonColes.calculateScoreMatrix(hD.npxG / aD.defensiveStability, aD.npxG / hD.defensiveStability, rhoData.rho);
                const [to25] = EdgeCalculator.removeVig([EdgeCalculator.impliedProbability(m.odds.over25), EdgeCalculator.impliedProbability(m.odds.under25)]);
                edge = EdgeCalculator.calculateEdge(DixonColes.calculateOverUnder(matrix, 2.5), to25);
                const s = edges.find(e => edge >= e.min && edge < e.max);
                if (s) { s.c++; s.e += edge; if (tg > 2.5) s.h++; }
            }

            totalB += brier;
            if (hB.purity === 1 && aB.purity === 1) { hpB += brier; hpC++; }
            const bin = bins.find(b => prob >= b.min && prob < b.max) || bins[9];
            bin.n++; bin.p += prob; if (outcome) bin.h++;
            if (math.predictionType === 'OVER_15' && isO15) ovC++;
            if (math.predictionType === 'UNDER_35' && isU35) unC++;
            totalC += math.probability;
            results.push({ match: m, prediction: { ...math, probability: Math.round(math.probability) } as any, isOver15Correct: isO15, isUnder35Correct: isU35, marketEdge: edge });

            await SignalFilter.updateStateAfterMatch(m.homeTeam, m.actualScore[0], m.actualScore[1], m.date, 1.0, false);
            await SignalFilter.updateStateAfterMatch(m.awayTeam, m.actualScore[1], m.actualScore[0], m.date, 1.0, false);
        }

        await SignalFilter.saveAll(await SignalFilter.getAll());
        SignalFilter.setCollection('teamStates');

        return {
            totalMatches: samples.length,
            over15Accuracy: (ovC / results.filter(r => r.prediction.predictionType === 'OVER_15').length) * 100,
            under35Accuracy: (unC / results.filter(r => r.prediction.predictionType === 'UNDER_35').length) * 100,
            averageConfidence: totalC / samples.length, brierScore: totalB / samples.length,
            highPurityBrierScore: hpC > 0 ? hpB / hpC : 0, highPurityMatches: hpC,
            calibrationBins: bins.filter(b => b.n > 0).map(b => ({ bin: `${(b.min * 100).toFixed(0)}-${(b.max * 100).toFixed(0)}%`, hitRate: b.h / b.n, expected: b.p / b.n, n: b.n })),
            edgeSegments: edges.map(s => ({ segment: s.n, count: s.c, hits: s.h, hitRate: s.c > 0 ? s.h / s.c : 0, avgEdge: s.c > 0 ? s.e / s.c : 0 })),
            matches: results
        };
    }
}

