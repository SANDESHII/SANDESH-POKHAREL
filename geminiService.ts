import { GoogleGenAI, Type } from "@google/genai";
import { 
    calculateProbability, 
    calculateMatchExpectancy,
    findTopTacticalPaths,
    IngestionService
} from "./src/services/engine";
import { getTeamBaseline } from "./src/services/baselineDataService";
import { AnalysisResult } from "./src/types";

const PRIMARY_MODEL = 'gemini-1.5-flash-latest'; 
const FALLBACK_MODEL = 'gemini-1.5-flash-8b-latest';

// --- MINIMAL QUEUE ---
let activeRequests = 0;
const MAX_CONCURRENT = 1;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY required.");
    return new GoogleGenAI({ apiKey });
};

// --- SCHEMA ---
const teamSchemaProperties = {
    name: { type: Type.STRING },
    goalsScored: { type: Type.NUMBER },
    goalsConceded: { type: Type.NUMBER },
    avgXG: { type: Type.NUMBER },
    avgXGA: { type: Type.NUMBER },
    npxG: { type: Type.NUMBER },
    xT: { type: Type.NUMBER },
    defensiveStability: { type: Type.NUMBER },
    offensiveVolatility: { type: Type.NUMBER },
    form: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    cleanSheets: { type: Type.NUMBER },
    matchHistory: { 
        type: Type.ARRAY, 
        items: { 
            type: Type.OBJECT,
            properties: {
                goalsScored: { type: Type.NUMBER },
                goalsConceded: { type: Type.NUMBER },
                xgScored: { type: Type.NUMBER },
                xgConceded: { type: Type.NUMBER },
                daysAgo: { type: Type.NUMBER },
                isHome: { type: Type.BOOLEAN }
            },
            required: ["goalsScored", "goalsConceded", "xgScored", "xgConceded", "daysAgo", "isHome"]
        }
    }
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        home: { type: Type.OBJECT, properties: teamSchemaProperties, required: Object.keys(teamSchemaProperties) },
        away: { type: Type.OBJECT, properties: teamSchemaProperties, required: Object.keys(teamSchemaProperties) },
        context: { 
            type: Type.OBJECT, 
            properties: {
                weather: { type: Type.STRING },
                matchContextFlag: { type: Type.STRING, enum: ["Dead-Rubber", "Derby", "Standard"] }
            },
            required: ["weather", "matchContextFlag"]
        },
        marketIndicators: {
            type: Type.OBJECT,
            properties: { marketMovementSignal: { type: Type.NUMBER } },
            required: ["marketMovementSignal"]
        },
        prediction: { type: Type.STRING },
        predictionType: { type: Type.STRING, enum: ["OVER", "UNDER", "BTTS", "WIN", "DRAW", "STABILITY"] },
        matchSummary: { type: Type.STRING },
        ingestedDataSummary: { type: Type.STRING },
        adjustment: {
            type: Type.OBJECT,
            properties: {
                adjustmentA: { type: Type.NUMBER },
                adjustmentB: { type: Type.NUMBER },
                reliabilityScore: { type: Type.NUMBER },
                aiScoringBaseline: { type: Type.NUMBER },
                aiPotentialLimit: { type: Type.NUMBER }
            },
            required: ["adjustmentA", "adjustmentB", "reliabilityScore"]
        }
    },
    required: ["home", "away", "context", "marketIndicators", "matchSummary", "adjustment", "ingestedDataSummary"]
};

const generateAnalysisPrompt = (req: any, baselines: any, isSearchEnabled: boolean) => {
    return `ANALYZE_MATCH: ${req.homeTeam} vs ${req.awayTeam} (${req.league}). 
    Home Baseline: ${JSON.stringify(baselines.home)}
    Away Baseline: ${JSON.stringify(baselines.away)}
    Search Enabled: ${isSearchEnabled}.
    Provide a detailed match analysis based on current team form and underlying metrics.
    Return JSON per schema.`;
};

const generateFallbackAnalysis = (req: any): AnalysisResult => {
    const home = getTeamBaseline(req.homeTeam);
    const away = getTeamBaseline(req.awayTeam);
    const hP = IngestionService.standardize({ ...home, name: req.homeTeam }, { adjustmentA: 1, adjustmentB: 1 });
    const aP = IngestionService.standardize({ ...away, name: req.awayTeam }, { adjustmentA: 1, adjustmentB: 1 });
    const dc = calculateMatchExpectancy(hP, aP, 0.2, 0);
    const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
    const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, topPaths[0].phases);

    return {
        probability: math.probability,
        summary: `Reference projection based on historical averages.`,
        homeStats: hP,
        awayStats: aP,
        homeXG: dc.homeScoring,
        awayXG: dc.awayScoring,
        dependence: dc.dependence,
        tacticalPath: topPaths[0].phases,
        prediction: dc.homeScoring + dc.awayScoring > 1.5 ? "OVER 1.5 GOALS" : "UNDER 3.5 GOALS",
        predictionType: dc.homeScoring + dc.awayScoring > 1.5 ? "OVER" : "UNDER",
        minimumExpectancy: (hP.npxG + aP.npxG) * 0.6,
        potentialCeiling: 3.5,
        context: { weather: "Standard", referee: "Neutral", stadium: "Neutral", historicalRivalry: 0.3, stakes: "Standard" },
        marketIndicators: { volume: "MEDIUM", marketDivergence: 0, sentimentScore: 0.5, marketMovementSignal: 0 },
        dataConsistency: { contradictions: ["Fallback used"], riskScore: 0.3 },
        modelAudit: { signalPurity: 0.7, analysisStability: 0.7, noiseRatio: 0.3 },
        adjustment: { adjustmentA: 1, adjustmentB: 1, reliabilityScore: 0.6 }
    };
};

export const performAnalysis = async (req: any): Promise<AnalysisResult> => {
    if (activeRequests >= MAX_CONCURRENT) {
        return generateFallbackAnalysis(req);
    }

    const ai = getAI();
    activeRequests++;
    
    let retryCount = 0;
    const maxRetries = 2;

    const attemptAnalysis = async (modelName: string): Promise<AnalysisResult | null> => {
        try {
            await sleep(500 * (retryCount + 1)); // Backoff
            const homeBaseline = getTeamBaseline(req.homeTeam);
            const awayBaseline = getTeamBaseline(req.awayTeam);
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: generateAnalysisPrompt(req, { home: homeBaseline, away: awayBaseline }, !!req.isSearchEnabled) }] }],
                config: { 
                    responseMimeType: "application/json", 
                    responseSchema: analysisSchema as any 
                }
            });

            if (!response.text) return null;
            const parsed = JSON.parse(response.text.trim());
            
            const hD = IngestionService.standardize(parsed.home, parsed.adjustment);
            const aD = IngestionService.standardize(parsed.away, parsed.adjustment);
            const dc = calculateMatchExpectancy(hD, aD, 0.2, parsed.marketIndicators.marketMovementSignal);
            const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
            const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, topPaths[0].phases);

            return {
                probability: math.probability,
                summary: parsed.matchSummary,
                homeStats: hD,
                awayStats: aD,
                homeXG: dc.homeScoring,
                awayXG: dc.awayScoring,
                dependence: dc.dependence,
                tacticalPath: topPaths[0].phases,
                prediction: parsed.prediction || (dc.homeScoring + dc.awayScoring > 1.5 ? "OVER 1.5 GOALS" : "UNDER 3.5 GOALS"),
                predictionType: parsed.predictionType || (dc.homeScoring + dc.awayScoring > 1.5 ? "OVER" : "UNDER"),
                minimumExpectancy: parsed.adjustment.aiScoringBaseline || 0.5,
                potentialCeiling: parsed.adjustment.aiPotentialLimit || 3.5,
                context: {
                    weather: parsed.context.weather || "Standard",
                    referee: "Neutral", stadium: "Neutral", historicalRivalry: 0.5, stakes: "Standard"
                },
                marketIndicators: {
                    volume: "MEDIUM", marketDivergence: 0, sentimentScore: 0.5,
                    marketMovementSignal: parsed.marketIndicators.marketMovementSignal || 0
                },
                dataConsistency: { contradictions: [], riskScore: 0.1 },
                modelAudit: { signalPurity: 0.8, analysisStability: 0.8, noiseRatio: 0.2 },
                adjustment: parsed.adjustment
            };
        } catch (e: any) {
            console.warn(`Attempt ${retryCount + 1} failed for ${modelName}:`, e.message);
            if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')) {
                return null;
            }
            throw e;
        }
    };

    try {
        let result = await attemptAnalysis(PRIMARY_MODEL);
        
        while (!result && retryCount < maxRetries) {
            retryCount++;
            result = await attemptAnalysis(retryCount === maxRetries ? FALLBACK_MODEL : PRIMARY_MODEL);
        }

        return result || generateFallbackAnalysis(req);
    } catch (e) {
        console.error("Critical Analysis Error:", e);
        return generateFallbackAnalysis(req);
    } finally {
        activeRequests--;
    }
};
