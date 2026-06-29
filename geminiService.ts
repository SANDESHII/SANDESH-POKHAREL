import { GoogleGenAI, Type } from "@google/genai";
import { 
    calculateProbability, 
    calculateMatchExpectancy,
    findTopTacticalPaths,
    calculateConfidenceAudit,
    IngestionService
} from "./src/services/engine";
import { getTeamBaseline } from "./src/services/baselineDataService";
import { AnalysisResult } from "./src/types";

const PRIMARY_MODEL = 'gemini-3.5-flash'; 
const FALLBACK_MODEL = 'gemini-flash-latest';
const cache = new Map<string, { result: AnalysisResult, timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY required.");
    return new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
};

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
                matchContextFlag: { type: Type.STRING, enum: ["Dead-Rubber", "Derby", "Standard"] },
                marketSentiment: { type: Type.STRING },
                tacticalDrift: { type: Type.STRING }
            },
            required: ["weather", "matchContextFlag", "marketSentiment", "tacticalDrift"]
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

const SystemLog = (msg: string) => console.log(`[SIGNAL] ${msg}`);

const SYSTEM_INSTRUCTION = `Lead Quantitative Data Architect. Objective: ZBIE. Extract Tactical Drifts, Market Anomaly, Statistical Purity. Return strict JSON.`;

const generateAnalysisPrompt = (req: any, baselines: any) => `
    EXECUTE SIGNAL HARVESTING: ${req.homeTeam} vs ${req.awayTeam} (League: ${req.league || 'Unknown'})
    1. SEARCH: Weather, referee, team news.
    2. ANALYZE: Compare findings against baselines: Home: ${JSON.stringify(baselines.home)}, Away: ${JSON.stringify(baselines.away)}
    3. QUANTIFY: Return JSON report citing findings in 'matchSummary'.`;

const generateFallbackAnalysis = (req: any): AnalysisResult => {
    const home = getTeamBaseline(req.homeTeam);
    const away = getTeamBaseline(req.awayTeam);
    const hP = IngestionService.standardize({ ...home, name: req.homeTeam }, { adjustmentA: 1, adjustmentB: 1 });
    const aP = IngestionService.standardize({ ...away, name: req.awayTeam }, { adjustmentA: 1, adjustmentB: 1 });
    const dc = calculateMatchExpectancy(hP, aP, 0.2, 0, { 
        weather: "STANDARD", 
        stakes: "STANDARD", 
        marketSentiment: "NEUTRAL", 
        tacticalDrift: "STABLE" 
    });
    const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
    const verifiedPath = topPaths[0];
    const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, verifiedPath.phases);
    const xGSum = dc.homeScoring + dc.awayScoring;
    
    return {
        probability: math.probability,
        summary: `Reference projection based on historical averages (Fallback Mode).`,
        homeStats: hP,
        awayStats: aP,
        homeXG: dc.homeScoring,
        awayXG: dc.awayScoring,
        dependence: dc.dependence,
        tacticalPath: verifiedPath.phases,
        verifiedOptimalPath: verifiedPath,
        prediction: xGSum > 2.5 ? "OVER 2.5" : (xGSum > 1.5 ? "OVER 1.5" : "UNDER 3.5"),
        predictionType: xGSum > 1.5 ? "OVER" : "UNDER",
        minimumExpectancy: (hP.npxG + aP.npxG) * 0.6,
        potentialCeiling: 3.5,
        context: { weather: "Standard", stakes: "Standard", marketSentiment: "Neutral", tacticalDrift: "Stable" },
        marketIndicators: { volume: "MEDIUM", sentimentScore: 0.5 },
        modelAudit: { signalPurity: 0.7, analysisStability: 0.7, noiseRatio: 0.3 },
        surety: calculateConfidenceAudit(math.probability, { signalPurity: 0.7, analysisStability: 0.7, noiseRatio: 0.3 })
    };
};

export const performAnalysis = async (req: any): Promise<AnalysisResult> => {
    const cacheKey = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase().replace(/\s/g, '');
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) return cachedEntry.result;

    const ai = getAI();
    let retryCount = 0;
    const maxRetries = 2;

    const attemptAnalysis = async (modelName: string): Promise<AnalysisResult | null> => {
        try {
            SystemLog(`Probing: ${modelName}`);
            
            // Exponential backoff
            if (retryCount > 0) {
                const waitTime = Math.pow(2, retryCount) * 1000;
                SystemLog(`Backoff: waiting ${waitTime}ms...`);
                await sleep(waitTime);
            }

            const baselines = { home: getTeamBaseline(req.homeTeam), away: getTeamBaseline(req.awayTeam) };
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: generateAnalysisPrompt(req, baselines) }] }],
                config: { 
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json", 
                    responseSchema: analysisSchema as any,
                    tools: [{ googleSearch: {} }] as any
                }
            });

            if (!response.text) return null;
            const parsed = JSON.parse(response.text.trim());
            const normalize = (s: string | undefined, fallback: string) => (s && s.length > 2) ? s.trim().toUpperCase() : fallback;

            const hD = IngestionService.standardize(parsed.home, parsed.adjustment);
            const aD = IngestionService.standardize(parsed.away, parsed.adjustment);
            const context = {
                weather: normalize(parsed.context?.weather, "STANDARD"),
                stakes: normalize(parsed.context?.matchContextFlag, "STANDARD"),
                marketSentiment: normalize(parsed.context?.marketSentiment, "NEUTRAL"),
                tacticalDrift: normalize(parsed.context?.tacticalDrift, "STABLE")
            };

            const dc = calculateMatchExpectancy(hD, aD, 0.2, parsed.marketIndicators.marketMovementSignal, context);
            const topPaths = findTopTacticalPaths(dc.homeScoring, dc.awayScoring);
            const verifiedPath = topPaths[0];
            const math = calculateProbability(dc.homeScoring, dc.awayScoring, dc.dependence, verifiedPath.phases);
            const audit = { signalPurity: 0.9, analysisStability: 0.85, noiseRatio: 0.1 };

            const finalResult: AnalysisResult = {
                probability: math.probability,
                summary: parsed.matchSummary,
                homeStats: hD,
                awayStats: aD,
                homeXG: dc.homeScoring,
                awayXG: dc.awayScoring,
                dependence: dc.dependence,
                tacticalPath: verifiedPath.phases,
                verifiedOptimalPath: verifiedPath,
                prediction: parsed.prediction || (dc.homeScoring + dc.awayScoring > 1.5 ? "OVER 1.5" : "UNDER 3.5"),
                predictionType: (parsed.predictionType || (dc.homeScoring + dc.awayScoring > 1.5 ? "OVER" : "UNDER")) as any,
                minimumExpectancy: parsed.adjustment.aiScoringBaseline || 0.5,
                potentialCeiling: parsed.adjustment.aiPotentialLimit || 3.5,
                context,
                marketIndicators: { volume: "MEDIUM", sentimentScore: 0.5 },
                modelAudit: audit,
                surety: calculateConfidenceAudit(math.probability, audit)
            };

            cache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
            return finalResult;
        } catch (e: any) {
            const isQuotaError = e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED");
            SystemLog(`${isQuotaError ? 'QUOTA EXCEEDED' : 'FAILED'}: ${e.message}`);
            
            // If it's a quota error and we are out of retries, we'll hit the fallback
            if (isQuotaError && retryCount >= maxRetries) {
                SystemLog("Quota depleted. Falling back to statistical engine.");
            }
            return null;
        }
    };

    let result = await attemptAnalysis(PRIMARY_MODEL);
    while (!result && retryCount < maxRetries) {
        retryCount++;
        result = await attemptAnalysis(retryCount === 1 ? FALLBACK_MODEL : PRIMARY_MODEL);
    }
    return result || generateFallbackAnalysis(req);
};

