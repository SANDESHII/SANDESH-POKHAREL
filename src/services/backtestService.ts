
import fs from 'fs';
import path from 'path';
import { getTeamBaseline } from './baselineDataService';
import { 
    calculateProbability, 
    calculateMatchExpectancy, 
    findTopTacticalPaths,
    IngestionService,
    StateStore
} from './engine';
import { MatchContext, AnalysisResult } from '../types';

export interface HistoricalMatch {
    date: string;
    homeTeam: string;
    awayTeam: string;
    actualScore: [number, number];
    league: string;
    context: MatchContext;
}

export interface BacktestSummary {
    totalMatches: number;
    over15Accuracy: number;
    under35Accuracy: number;
    averageConfidence: number;
    brierScore: number;
    calibrationBins: { bin: string; hitRate: number; expected: number; n: number }[];
    matches: Array<{
        match: HistoricalMatch;
        prediction: AnalysisResult;
        isOver15Correct: boolean;
        isUnder35Correct: boolean;
    }>;
}

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
                    }
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
        StateStore.reset();
        
        const results: BacktestSummary["matches"] = [];
        let totalBrier = 0;
        let overCorrect = 0;
        let underCorrect = 0;
        let totalConf = 0;

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
            const hState = StateStore.get(match.homeTeam);
            const aState = StateStore.get(match.awayTeam);

            const ingested = {
                home: {
                    ...hBase,
                    name: match.homeTeam,
                    npxG: hState ? hState.estimatedNpxG : hBase.npxG,
                    dataPurity: hBase.purity
                },
                away: {
                    ...aBase,
                    name: match.awayTeam,
                    npxG: aState ? aState.estimatedNpxG : aBase.npxG,
                    dataPurity: aBase.purity
                },
                adjustment: { adjustmentA: 0.5, adjustmentB: 0.5, reliabilityScore: 0.9 }
            };

            const hD = IngestionService.standardize(ingested.home, ingested.adjustment);
            const aD = IngestionService.standardize(ingested.away, ingested.adjustment);
            
            // 1. Predict (Using current latent states)
            const dc = calculateMatchExpectancy(hD, aD, 0.2, 0, { ...match.context, date: match.date });
            const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
            const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, topPaths[0].phases, dc.purity, dc.eloDiff, match.context);
            
            const totalGoals = match.actualScore[0] + match.actualScore[1];
            const isOver15 = totalGoals > 1.5;
            const isUnder35 = totalGoals < 3.5;
            const predProb = math.probability / 100;
            const predType = math.predictionType;

            // 2. Score Calibration
            const outcome = predType === 'OVER_15' ? isOver15 : isUnder35;
            const brier = Math.pow(predProb - (outcome ? 1 : 0), 2);
            totalBrier += brier;

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
                isUnder35Correct: isUnder35
            });

            // 3. Update Loop (Walk-Forward)
            // Update the StateStore with the ACTUAL observed result to influence future predictions
            StateStore.updateStateAfterMatch(match.homeTeam, match.actualScore[0], match.actualScore[1], match.date);
            StateStore.updateStateAfterMatch(match.awayTeam, match.actualScore[1], match.actualScore[0], match.date);
        }

        return {
            totalMatches: samples.length,
            over15Accuracy: (overCorrect / samples.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'OVER_15').length) * 100,
            under35Accuracy: (underCorrect / samples.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'UNDER_35').length) * 100,
            averageConfidence: totalConf / samples.length,
            brierScore: totalBrier / samples.length,
            calibrationBins: bins.filter(b => b.n > 0).map(b => ({
                bin: `${(b.min * 100).toFixed(0)}-${(b.max * 100).toFixed(0)}%`,
                hitRate: b.hits / b.n,
                expected: b.sumProb / b.n,
                n: b.n
            })),
            matches: results
        };
    }
}
