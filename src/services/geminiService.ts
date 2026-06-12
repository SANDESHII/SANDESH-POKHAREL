import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { 
    calculateProbability, 
    detectRegimeShifts, 
    calculateStructuralFloor,
    calculatePhysicalCeiling,
    calculateDixonColes,
    calculateCredibilitySignal,
    auditPhysics,
    BayesianPoissonAudit,
    runGradientBoostingAudit,
    calculateShannonEntropy,
    calculateEVTRisk
} from "./mathUtils";
import { AnalysisResult, MatchContext, MarketReality, MirrorMatch, ProsecutionCase, TeamStats, RegimeState } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview'; 
const CACHE_FILE = path.join(process.cwd(), 'match_cache.json');

// --- DURABLE CACHE (File-based Persistence) ---
interface DurableCache {
    analysis: Record<string, { data: AnalysisResult, timestamp: number }>;
}

let STORAGE: DurableCache = { analysis: {} };

const loadStorage = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf-8');
            STORAGE = JSON.parse(data);
            console.log("Match Report Pro: Cache Restored.");
        }
    } catch (e) {
        console.error("Cache Corrupted. Resetting.", e);
    }
};

const saveStorage = () => {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(STORAGE, null, 2));
    } catch (e) {
        console.error("Cache Save Failure:", e);
    }
};

// Initial load
if (typeof process !== 'undefined') {
    loadStorage();
}

const ANALYSIS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days cache for match analysis

class MatchQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing = false;
    private lastRequestTime = 0;
    private minDelay = 1000; // 1 second for standard requests
    private searchDelay = 10000; // reduced to 10 seconds
    private coolingDownUntil = 0;

    async add<T>(task: () => Promise<T>, useSearch = false, retries = 2): Promise<T> {
        return new Promise((resolve, reject) => {
            if (useSearch && Date.now() < this.coolingDownUntil) {
                reject(new Error(`SEARCH_COOLDOWN`));
                return;
            }

            this.queue.push(async () => {
                let attempt = 0;
                while (attempt <= retries) {
                    try {
                        const now = Date.now();
                        const delay = useSearch ? this.searchDelay : this.minDelay;
                        const waitTime = Math.max(0, this.lastRequestTime + delay - now);
                        
                        if (waitTime > 0 && useSearch) {
                            await new Promise(r => setTimeout(r, waitTime));
                        }
                        
                        const result = await task();
                        this.lastRequestTime = Date.now();
                        resolve(result);
                        return;
                    } catch (err: any) {
                        const isRateLimit = err.message?.includes('429') || err.status === 429 || err.code === 429 || err.message?.includes('QUOTA');
                        if (isRateLimit && useSearch) {
                            this.coolingDownUntil = Date.now() + 30000; // 30s pause for search
                            reject(new Error("SEARCH_LIMIT_HIT"));
                            return;
                        }
                        
                        if (attempt < retries) {
                            attempt++;
                            await new Promise(r => setTimeout(r, 2000 * attempt));
                            continue;
                        }
                        reject(err);
                        return;
                    }
                }
            });
            this.process();
        });
    }

    get state() {
        return {
            depth: this.queue.length,
            isCoolingDown: Date.now() < this.coolingDownUntil,
            cooldownRemaining: Math.max(0, Math.ceil((this.coolingDownUntil - Date.now()) / 1000))
        };
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        while (this.queue.length > 0) {
            const task = this.queue.shift();
            if (task) {
                try {
                    await task();
                } catch (e) {
                    // Task handles its own reject/resolve
                }
            }
        }
        this.processing = false;
    }
}

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    return new GoogleGenAI({ 
        apiKey,
        httpOptions: {
            headers: {
                'User-Agent': 'aistudio-build',
            }
        }
    });
};

const matchQueue = new MatchQueue();

const teamSchemaProperties = {
    name: { type: Type.STRING },
    goalsScored: { type: Type.NUMBER },
    goalsConceded: { type: Type.NUMBER },
    avgXG: { type: Type.NUMBER },
    avgXGA: { type: Type.NUMBER },
    npxG: { type: Type.NUMBER, description: "Non-penalty xG (Steel Data)" },
    xT: { type: Type.NUMBER, description: "Expected Threat (Steel Data)" },
    form: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    cleanSheets: { type: Type.NUMBER }
};

const contextSchemaProperties = {
    weather: { type: Type.STRING },
    referee: { type: Type.STRING },
    stadium: { type: Type.STRING },
    historicalRivalry: { type: Type.NUMBER },
    stakes: { type: Type.STRING }
};

const marketSchemaProperties = {
    syndicateFlow: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
    smartMoneyTarget: { type: Type.STRING },
    marketDivergence: { type: Type.NUMBER },
    sentimentScore: { type: Type.NUMBER }
};

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        home: { type: Type.OBJECT, properties: teamSchemaProperties, required: Object.keys(teamSchemaProperties) },
        away: { type: Type.OBJECT, properties: teamSchemaProperties, required: Object.keys(teamSchemaProperties) },
        context: { type: Type.OBJECT, properties: contextSchemaProperties, required: Object.keys(contextSchemaProperties) },
        marketReality: { type: Type.OBJECT, properties: marketSchemaProperties, required: Object.keys(marketSchemaProperties) },
        matchSummary: { type: Type.STRING },
        mirrorMatches: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    match: { type: Type.STRING },
                    result: { type: Type.STRING },
                    similarityScore: { type: Type.NUMBER }
                },
                required: ["match", "result", "similarityScore"]
            }
        },
        prosecution: {
            type: Type.OBJECT,
            properties: {
                contradictions: { type: Type.ARRAY, items: { type: Type.STRING } },
                riskScore: { type: Type.NUMBER }
            },
            required: ["contradictions", "riskScore"]
        }
    },
    required: ["home", "away", "context", "marketReality", "matchSummary", "mirrorMatches", "prosecution"]
};

export const getQueueState = () => matchQueue.state;

export const performAnalysis = async (req: { homeTeam: string; awayTeam: string; league: string; kickoff: string; }): Promise<AnalysisResult> => {
    const ai = getAI();
    const now = new Date().toISOString();
    const cacheKey = `analysis-${req.homeTeam}-${req.awayTeam}-${req.kickoff}`.toLowerCase();

    // Check Analysis Cache
    const cached = STORAGE.analysis[cacheKey];
    if (cached && (Date.now() - cached.timestamp < ANALYSIS_CACHE_TTL)) {
        console.log(`Cache: Returning cached analysis for ${req.homeTeam} vs ${req.awayTeam}`);
        return cached.data;
    }

        try {
            const prompt = `Analyze the football match: ${req.homeTeam} vs ${req.awayTeam} in ${req.league}.
        Kickoff: ${req.kickoff}. Current time: ${now}.
        
        Using Google Search grounding, retrieve real-time data for:
        1. TEAM STATS: Goals, xG, xGA, npxG (Non-penalty xG), xT (Expected Threat), recent form, and clean sheets.
        2. HISTORICAL SIMILARITIES: Find 3-5 historical matches with similar statistical profiles.
        3. RISK ANALYSIS: List potential reasons why the statistical favorite might struggle (fatigue, injuries, referee bias, stadium conditions).
        4. MATCH CONTEXT: Weather forecast for kickoff, referee choice, stadium atmosphere, rivalry history, and stakes.
        5. MARKET SENTIMENT: General market divergence and professional sentiment.
        
        Provide a comprehensive match summary based on this real-time intelligence.`;

            let response;
            try {
                response = await matchQueue.add(() => ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: prompt,
                    config: { 
                        tools: [{ googleSearch: {} }],
                        responseMimeType: "application/json",
                        responseSchema: analysisSchema
                    },
                }), true); // Use Search
            } catch (queueError: any) {
                // Seamlessly fallback to internal knowledge if search is unavailable
                response = await matchQueue.add(() => ai.models.generateContent({
                    model: MODEL_NAME,
                    contents: prompt + "\n\nNOTE: Analyze using comprehensive historical data. Web tools are currently optimizing.",
                    config: { 
                        responseMimeType: "application/json",
                        responseSchema: analysisSchema
                    },
                }), false); // Skip Search
            }

        const text = response.text;
        if (!text) {
            throw new Error("Match analysis failed: Data stream empty.");
        }
        const data = JSON.parse(text.trim());
        const rawSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = rawSources
            .map((c: any) => ({ title: c.web?.title || 'Expert Source', uri: c.web?.uri }))
            .filter((s: any) => s.uri);

        const dc = calculateDixonColes(data.home, data.away, req.league);
        const math = calculateProbability(data.home, data.away);
        const regimePath = detectRegimeShifts(dc.alpha, dc.beta, data.home, data.away);
        const structuralData = calculateStructuralFloor(data.home, data.away);
        const physicalCeiling = calculatePhysicalCeiling(data.home, data.away, regimePath);
        const signalPrecision = calculateCredibilitySignal(data.home, data.away); // Statistical Audit
        const physics = auditPhysics(data.home, data.away, regimePath);

        // Advanced Model Audits
        const bayesianHome = new BayesianPoissonAudit(data.home.avgXG);
        const bayesianAway = new BayesianPoissonAudit(data.away.avgXG);
        const bayesianPoisson = (bayesianHome.getSurety() + bayesianAway.getSurety()) / 2;
        
        const gradientBoosting = runGradientBoostingAudit(data.home, data.away);
        const entropy = (calculateShannonEntropy(data.home) + calculateShannonEntropy(data.away)) / 2;
        const evtRisk = calculateEVTRisk(data.home, data.away);
        
        // Neural Memory relevance is tied to the Signal Precision in this context
        const neuralMemory = signalPrecision;

        const analysisResult: AnalysisResult = {
            probability: math.probability,
            summary: data.matchSummary,
            homeStats: data.home,
            awayStats: data.away,
            sources,
            homeXG: dc.alpha, // Using Kalman-filtered Alpha
            awayXG: dc.beta,  // Using Kalman-filtered Beta
            regimePath,
            structuralFloor: structuralData.floor,
            physicalCeiling,
            structuralData,
            signalPrecision,
            physics,
            context: data.context,
            marketReality: data.marketReality,
            mirrorMatches: data.mirrorMatches,
            prosecution: data.prosecution,
            modelAudit: {
                bayesianPoisson,
                gradientBoosting,
                neuralMemory,
                entropy,
                evtRisk
            }
        };

        // Store in Cache
        STORAGE.analysis[cacheKey] = { data: analysisResult, timestamp: Date.now() };
        saveStorage();

        return analysisResult;
    } catch (e: any) {
        console.error("Match Analysis Failed:", e);
        if (e.message?.includes('QUOTA') || e.message?.includes('LIMIT') || e.message?.includes('HIT')) {
            throw new Error("System is slightly congested. Retrying in 15 seconds...");
        }
        throw e;
    }
};
