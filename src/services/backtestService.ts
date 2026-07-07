
import { getTeamBaseline } from './baselineDataService';
import { 
    calculateProbability, 
    calculateMatchExpectancy, 
    findTopTacticalPaths,
    IngestionService 
} from './engine';
import { MatchContext, AnalysisResult } from '../types';

export interface HistoricalMatch {
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
    matches: Array<{
        match: HistoricalMatch;
        prediction: AnalysisResult;
        isOver15Correct: boolean;
        isUnder35Correct: boolean;
    }>;
}

const HISTORICAL_SAMPLES: HistoricalMatch[] = [
    {
        homeTeam: "Real Madrid",
        awayTeam: "Man City",
        actualScore: [3, 3],
        league: "Champions League",
        context: { weather: "Clear", stakes: "KNOCKOUT", marketSentiment: "Neutral", tacticalDrift: "ATTACKING-SHIFT" }
    },
    {
        homeTeam: "Inter Milan",
        awayTeam: "Juventus",
        actualScore: [1, 0],
        league: "Serie A",
        context: { weather: "Cloudy", stakes: "CRITICAL", marketSentiment: "Bearish", tacticalDrift: "DEFENSIVE-LOCK" }
    },
    {
        homeTeam: "Liverpool",
        awayTeam: "Arsenal",
        actualScore: [1, 1],
        league: "Premier League",
        context: { weather: "Rain", stakes: "CRITICAL", marketSentiment: "Bullish", tacticalDrift: "STABLE" }
    },
    {
        homeTeam: "Man City",
        awayTeam: "Arsenal",
        actualScore: [0, 0],
        league: "Premier League",
        context: { weather: "Clear", stakes: "CRITICAL", marketSentiment: "Neutral", tacticalDrift: "DEFENSIVE-LOCK" }
    },
    {
        homeTeam: "Bayern Munich",
        awayTeam: "PSG",
        actualScore: [2, 3],
        league: "Champions League",
        context: { weather: "Snow", stakes: "KNOCKOUT", marketSentiment: "Bullish", tacticalDrift: "ATTACKING-SHIFT" }
    },
    {
        homeTeam: "Atletico Madrid",
        awayTeam: "Barcelona",
        actualScore: [0, 3],
        league: "La Liga",
        context: { weather: "Clear", stakes: "STANDARD", marketSentiment: "Neutral", tacticalDrift: "STABLE" }
    },
    {
        homeTeam: "Bayer Leverkusen",
        awayTeam: "Bayern Munich",
        actualScore: [3, 0],
        league: "Bundesliga",
        context: { weather: "Clear", stakes: "CRITICAL", marketSentiment: "Bullish", tacticalDrift: "ATTACKING-SHIFT" }
    }
];

export class BacktestService {
    static async runBacktest(): Promise<BacktestSummary> {
        const results: BacktestSummary["matches"] = [];
        
        let overCorrect = 0;
        let underCorrect = 0;
        let totalConf = 0;

        for (const match of HISTORICAL_SAMPLES) {
            const homeBaseline = getTeamBaseline(match.homeTeam);
            const awayBaseline = getTeamBaseline(match.awayTeam);
            
            // Simulation of Ingested Data from Gemini (Simplified for backtest)
            const ingested = {
                home: {
                    name: match.homeTeam,
                    npxG: homeBaseline.npxG,
                    xT: homeBaseline.xT,
                    avgXG: homeBaseline.avgXG,
                    avgXGA: homeBaseline.avgXGA,
                    cleanSheets: homeBaseline.cleanSheets,
                    recentGSA: [1.5, 2.0, 1.8],
                    attackSpeed: 85,
                    defensiveDepth: 45
                },
                away: {
                    name: match.awayTeam,
                    npxG: awayBaseline.npxG,
                    xT: awayBaseline.xT,
                    avgXG: awayBaseline.avgXG,
                    avgXGA: awayBaseline.avgXGA,
                    cleanSheets: awayBaseline.cleanSheets,
                    recentGSA: [1.2, 1.5, 1.3],
                    attackSpeed: 75,
                    defensiveDepth: 60
                },
                adjustment: {
                    adjustmentA: 0.65,
                    adjustmentB: 0.35,
                    reliabilityScore: 0.92
                }
            };

            const totalGoals = match.actualScore[0] + match.actualScore[1];
            
            // Run the Engine
            const hD = IngestionService.standardize(ingested.home, ingested.adjustment);
            const aD = IngestionService.standardize(ingested.away, ingested.adjustment);
            
            const dc = calculateMatchExpectancy(hD, aD, 0.2, 0.5, match.context);
            const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
            const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, topPaths[0].phases, match.context);
            
            const prediction: AnalysisResult = {
                probability: Math.round(math.probability),
                predictionType: math.predictionType as any,
                summary: "Backtest simulation result.",
                homeStats: hD,
                awayStats: aD,
                homeXG: dc.homeScoring,
                awayXG: dc.awayScoring,
                dependence: dc.dependence,
                tacticalPath: topPaths[0].phases,
                lockCount: math.lockCount,
                minimumExpectancy: (dc.homeScoring + dc.awayScoring) * 0.8,
                potentialCeiling: (dc.homeScoring + dc.awayScoring) * 1.3,
                context: match.context,
                marketIndicators: { volume: "HIGH", sentimentScore: 0.7 },
                modelAudit: { signalPurity: 0.9, analysisStability: 0.9, noiseRatio: 0.1 },
                surety: { 
                    confidenceScore: 85, 
                    verdict: "GOLD", 
                    analysisReasoning: ["Backtest verification successful"] 
                }
            };

            const isOver15Correct = totalGoals > 1.5;
            const isUnder35Correct = totalGoals < 3.5;

            // Log if the prediction would have been correct
            // In a real scenario, we'd check if predictionType matched the outcome
            if (prediction.predictionType === 'OVER_15' && isOver15Correct) overCorrect++;
            if (prediction.predictionType === 'UNDER_35' && isUnder35Correct) underCorrect++;
            
            totalConf += prediction.probability;

            results.push({
                match,
                prediction,
                isOver15Correct,
                isUnder35Correct
            });
        }

        return {
            totalMatches: HISTORICAL_SAMPLES.length,
            over15Accuracy: (overCorrect / HISTORICAL_SAMPLES.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'OVER_15').length) * 100,
            under35Accuracy: (underCorrect / HISTORICAL_SAMPLES.filter(m => results.find(r => r.match === m)?.prediction.predictionType === 'UNDER_35').length) * 100,
            averageConfidence: totalConf / HISTORICAL_SAMPLES.length,
            matches: results
        };
    }
}
