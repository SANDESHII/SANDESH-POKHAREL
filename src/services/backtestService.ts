
import fs from 'fs';
import path from 'path';
import { getTeamBaseline } from './baselineDataService';
import { MatchEngine } from './engine';
import { StateStore } from '../core/kalman';
import { IngestionService } from './ingestionService';
import { PersistenceService } from './persistenceService';
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

export class BacktestService {
    private static parseCSV(csv: string): HistoricalMatch[] {
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        const homeIdx = headers.indexOf('HomeTeam');
        const awayIdx = headers.indexOf('AwayTeam');
        const dateIdx = headers.indexOf('Date');
        const hgIdx = headers.indexOf('FTHG');
        const agIdx = headers.indexOf('FTAG');
        const divIdx = headers.indexOf('Div');
        const over25Idx = headers.indexOf('Avg>2.5');
        const under25Idx = headers.indexOf('Avg<2.5');

        return lines.slice(1)
            .filter(line => line.trim() !== '')
            .map(line => {
                const parts = line.split(',');
                // Simple date conversion DD/MM/YYYY to ISO
                const dateParts = parts[dateIdx].split('/');
                const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                
                return {
                    date: isoDate,
                    homeTeam: parts[homeIdx],
                    awayTeam: parts[awayIdx],
                    actualScore: [parseInt(parts[hgIdx]), parseInt(parts[agIdx])] as [number, number],
                    league: parts[divIdx] === 'E0' ? 'Premier League' : parts[divIdx],
                    context: { 
                        weather: "Clear", 
                        stakes: "STANDARD", 
                        marketSentiment: "Neutral", 
                        tacticalDrift: "STABLE" 
                    },
                    odds: over25Idx !== -1 ? {
                        over25: parseFloat(parts[over25Idx]),
                        under25: parseFloat(parts[under25Idx])
                    } : undefined
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    static async runBacktest(): Promise<BacktestSummary> {
        const csvPath = path.join(process.cwd(), 'src/data/historical_pl_2324.csv');
        const csvData = fs.readFileSync(csvPath, 'utf8');
        const allMatches = this.parseCSV(csvData);
        
        // We only backtest a subset to keep it fast, but significant enough (N=150)
        const samples = allMatches.slice(0, 200);
        
        // Reset state for clean walk-forward
        StateStore.setCollection('backtest_teamStates');
        PersistenceService.setCollection('backtest_teamStates');
        await StateStore.reset();

        // 0. Pre-calculate Rho for the backtest period
        const teamAvgs = new Map<string, { scored: number, count: number }>();
        allMatches.forEach(m => {
            const h = teamAvgs.get(m.homeTeam) || { scored: 0, count: 0 };
            h.scored += m.actualScore[0];
            h.count++;
            teamAvgs.set(m.homeTeam, h);

            const a = teamAvgs.get(m.awayTeam) || { scored: 0, count: 0 };
            a.scored += m.actualScore[1];
            a.count++;
            teamAvgs.set(m.awayTeam, a);
        });

        const fitInputs = allMatches.map(m => ({
            x: m.actualScore[0],
            y: m.actualScore[1],
            lambda: teamAvgs.get(m.homeTeam)!.scored / teamAvgs.get(m.homeTeam)!.count,
            mu: teamAvgs.get(m.awayTeam)!.scored / teamAvgs.get(m.awayTeam)!.count
        }));

        const rhoData = DixonColes.fitRho(fitInputs);
        console.log(`[BACKTEST] Fitted Rho: ${rhoData.rho.toFixed(4)}`);
        
        const results: BacktestSummary["matches"] = [];
        let totalBrier = 0;
        let highPurityBrier = 0;
        let highPurityCount = 0;
        let overCorrect = 0;
        let underCorrect = 0;
        let totalConf = 0;

        // Market Edge Segments
        const edgeSegments = [
            { name: 'High Edge (> 5 pts)', min: 0.05, max: 1.0, count: 0, hits: 0, sumEdge: 0 },
            { name: 'Moderate Edge (2-5 pts)', min: 0.02, max: 0.05, count: 0, hits: 0, sumEdge: 0 },
            { name: 'No/Neg Edge (< 2 pts)', min: -1.0, max: 0.02, count: 0, hits: 0, sumEdge: 0 }
        ];

        // Calibration Bins
        const bins = Array.from({ length: 10 }, (_, i) => ({
            min: i * 0.1,
            max: (i + 1) * 0.1,
            n: 0,
            hits: 0,
            sumProb: 0
        }));

        for (const match of samples) {
            // 1. Get current states for these teams
            const hBase = getTeamBaseline(match.homeTeam);
            const aBase = getTeamBaseline(match.awayTeam);
            
            // In walk-forward, we "ingest" data as it would have appeared
            // We use the latent estimated state if it exists, else baseline
            const hState = await StateStore.get(match.homeTeam);
            const aState = await StateStore.get(match.awayTeam);

            const ingested = {
                home: {
                    ...hBase,
                    name: match.homeTeam,
                    npxG: hState ? hState.estimatedNpxG : hBase.npxG,
                    npxGVariance: hState ? hState.variance : 0.5,
                    dataPurity: hBase.purity
                },
                away: {
                    ...aBase,
                    name: match.awayTeam,
                    npxG: aState ? aState.estimatedNpxG : aBase.npxG,
                    npxGVariance: aState ? aState.variance : 0.5,
                    dataPurity: aBase.purity
                },
                adjustment: { adjustmentA: 0.5, adjustmentB: 0.5, reliabilityScore: 0.9 }
            };

            const hD = IngestionService.standardize(ingested.home, ingested.adjustment);
            const aD = IngestionService.standardize(ingested.away, ingested.adjustment);
            
            // 1. Predict
            const math = MatchEngine.calculateMatchExpectancy(hD, aD, { ...match.context, date: match.date }, undefined, rhoData);
            
            const totalGoals = match.actualScore[0] + match.actualScore[1];
            const isOver15 = totalGoals > 1.5;
            const isUnder35 = totalGoals < 3.5;
            const predProb = math.probability / 100;
            const predType = math.predictionType;

            // 2. Market Edge Calculation (using Over 2.5 if available for analysis)
            let marketEdge = 0;
            if (match.odds) {
                // Calculate model's Over 2.5 prob for market comparison
                const hScoring = hD.npxG * (1 / aD.defensiveStability);
                const aScoring = aD.npxG * (1 / hD.defensiveStability);
                const matrix = DixonColes.calculateScoreMatrix(hScoring, aScoring, rhoData.rho);
                const modelOver25 = DixonColes.calculateOverUnder(matrix, 2.5);

                const overImplied = EdgeCalculator.impliedProbability(match.odds.over25);
                const underImplied = EdgeCalculator.impliedProbability(match.odds.under25);
                const [trueOver25] = EdgeCalculator.removeVig([overImplied, underImplied]);
                
                marketEdge = EdgeCalculator.calculateEdge(modelOver25, trueOver25);
                
                // Track in segments
                const seg = edgeSegments.find(s => marketEdge >= s.min && marketEdge < s.max);
                if (seg) {
                    seg.count++;
                    seg.sumEdge += marketEdge;
                    if (totalGoals > 2.5) seg.hits++;
                }
            }

            // 3. Score Calibration
            const outcome = predType === 'OVER_15' ? isOver15 : isUnder35;
            const brier = Math.pow(predProb - (outcome ? 1 : 0), 2);
            totalBrier += brier;

            if (hBase.purity === 1.0 && aBase.purity === 1.0) {
                highPurityBrier += brier;
                highPurityCount++;
            }

            const bin = bins.find(b => predProb >= b.min && predProb < b.max) || bins[9];
            bin.n++;
            bin.sumProb += predProb;
            if (outcome) bin.hits++;

            if (predType === 'OVER_15' && isOver15) overCorrect++;
            if (predType === 'UNDER_35' && isUnder35) underCorrect++;
            totalConf += math.probability;

            results.push({
                match,
                prediction: { ...math, probability: Math.round(math.probability) } as any,
                isOver15Correct: isOver15,
                isUnder35Correct: isUnder35,
                marketEdge
            });

            // 4. Update Loop (Walk-Forward)
            // Update the StateStore with the ACTUAL observed result to influence future predictions
            await StateStore.updateStateAfterMatch(match.homeTeam, match.actualScore[0], match.actualScore[1], match.date);
            await StateStore.updateStateAfterMatch(match.awayTeam, match.actualScore[1], match.actualScore[0], match.date);
        }

        // Persist the final latent states to Firestore after the walk-forward is complete (StateStore already does this per update, but we keep this for compatibility or batch safety)
        await PersistenceService.saveTeamStates(await StateStore.getAll());

        // Restore production collection names
        StateStore.setCollection('teamStates');
        PersistenceService.setCollection('teamStates');

        return {
            totalMatches: samples.length,
            over15Accuracy: (overCorrect / samples.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'OVER_15').length) * 100,
            under35Accuracy: (underCorrect / samples.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'UNDER_35').length) * 100,
            averageConfidence: totalConf / samples.length,
            brierScore: totalBrier / samples.length,
            highPurityBrierScore: highPurityCount > 0 ? highPurityBrier / highPurityCount : 0,
            highPurityMatches: highPurityCount,
            calibrationBins: bins.filter(b => b.n > 0).map(b => ({
                bin: `${(b.min * 100).toFixed(0)}-${(b.max * 100).toFixed(0)}%`,
                hitRate: b.hits / b.n,
                expected: b.sumProb / b.n,
                n: b.n
            })),
            edgeSegments: edgeSegments.map(s => ({
                segment: s.name,
                count: s.count,
                hits: s.hits,
                hitRate: s.count > 0 ? s.hits / s.count : 0,
                avgEdge: s.count > 0 ? s.sumEdge / s.count : 0
            })),
            matches: results
        };
    }
}
