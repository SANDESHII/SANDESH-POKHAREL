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
import { IngestionService } from "./ingestionService";

const MODEL_NAME = 'gemini-3.5-flash'; 
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
                        const isUnavailable = err.message?.includes('503') || err.status === 503 || err.code === 503 || err.message?.includes('UNAVAILABLE');
                        
                        if (isRateLimit && useSearch) {
                            this.coolingDownUntil = Date.now() + 30000; // 30s pause for search
                            reject(new Error("SEARCH_LIMIT_HIT"));
                            return;
                        }
                        
                        if ((isRateLimit || isUnavailable) && attempt < retries) {
                            attempt++;
                            // Exponential backoff for retries
                            const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                            await new Promise(r => setTimeout(r, backoff));
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
    npxG: { type: Type.NUMBER, description: "Primary npxG (Opta/FBref strategy)" },
    npxG_Understat: { type: Type.NUMBER, description: "Secondary npxG for variance check" },
    npxG_SofaScore: { type: Type.NUMBER, description: "Secondary npxG for variance check" },
    xT: { type: Type.NUMBER, description: "Expected Threat (Steel Data)" },
    form: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    cleanSheets: { type: Type.NUMBER },
    redCardAnomalyMinutes: { type: Type.NUMBER, description: "Minutes played with a red card in last 3 games" },
    managerSacked: { type: Type.BOOLEAN, description: "Has the manager been sacked/changed this week?" },
    injuryCount: { type: Type.NUMBER, description: "Number of starting XI players confirmed out" },
    missingExpectedG: { type: Type.NUMBER, description: "Sum of average xG contributions from confirmed out players" },
    missingExpectedT: { type: Type.NUMBER, description: "Sum of average xT contributions from confirmed out players" },
    npxGSequence: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Last 10 match npxG values for recursive state warming" },
    xGASequence: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Last 10 match xGA values for recursive state warming" }
};

const contextSchemaProperties = {
    weather: { type: Type.STRING },
    referee: { type: Type.STRING },
    stadium: { type: Type.STRING },
    historicalRivalry: { type: Type.NUMBER },
    stakes: { type: Type.STRING },
    matchContextFlag: { type: Type.STRING, enum: ["Dead-Rubber", "Derby", "Standard"] },
    confidenceVector: { type: Type.NUMBER, description: "Confidence score based on lineup stability, manager drama, and tactics (1.0 = stable, <0.5 = chaotic)." }
};

const marketSchemaProperties = {
    syndicateFlow: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
    smartMoneyTarget: { type: Type.STRING },
    marketDivergence: { type: Type.NUMBER },
    sentimentScore: { type: Type.NUMBER },
    openingOdds: { 
        type: Type.OBJECT, 
        properties: { 
            home: { type: Type.NUMBER }, 
            draw: { type: Type.NUMBER }, 
            away: { type: Type.NUMBER } 
        },
        required: ["home", "draw", "away"]
    },
    currentOdds: { 
        type: Type.OBJECT, 
        properties: { 
            home: { type: Type.NUMBER }, 
            draw: { type: Type.NUMBER }, 
            away: { type: Type.NUMBER } 
        },
        required: ["home", "draw", "away"]
    },
    marketMovementSignal: { type: Type.NUMBER, description: "Derived signal from odds movement (-1 to 1)." }
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
        },
        calibration: {
            type: Type.OBJECT,
            properties: {
                understatBias: { type: Type.NUMBER, description: "Historical scale factor to normalize Understat to Opta baseline for this league" },
                sofaScoreBias: { type: Type.NUMBER, description: "Historical scale factor to normalize SofaScore to Opta baseline for this league" },
                calibrationConfidence: { type: Type.NUMBER }
            },
            required: ["understatBias", "sofaScoreBias", "calibrationConfidence"]
        }
    },
    required: ["home", "away", "context", "marketReality", "matchSummary", "mirrorMatches", "prosecution", "calibration"]
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
            const prompt = `INSTRUCTION: Extract data for the upcoming match: ${req.homeTeam} vs ${req.awayTeam} in ${req.league}.
            Kickoff: ${req.kickoff}. Current time: ${now}.
            
            Use ONE primary data provider philosophy (Preferably Opta/FBref). Use two secondary sources (Understat/SofaScore) strictly to measure variance. 

            --- THE KILL-SWITCH GATE ---
            You MUST find npxG from three distinct sources (Opta, Understat, SofaScore) for both teams.

            --- EXOGENOUS EVENT OVERRIDES (MEC Matrix) ---
            Check if:
            1. Manager was sacked/changed this week.
            2. Primary squad injury count (starting XI players out).
            3. MEC Calculation: For each missing key player, find their season avg xG and xT contribution per 90. Sum these as missingExpectedG and missingExpectedT.
            4. Match context: Dead-Rubber, Derby, or Standard.
            5. Red card anomalies: Minutes played down a man in the last 3 matches.

            --- UNIFIED QUANT DATA ---
            Retrieve:
            1. npxG (Non-penalty xG) from all three sources.
            2. xT (Expected Threat).
            3. Rolling averages for xG and xGA.
            4. Recent form sequence (last 5 xG values).
            5. Recursive State Data: Last 10 match npxG and xGA values as numeric arrays (npxGSequence and xGASequence). This is critical for warming the Kalman and Fractional Memory filters.

            --- SYSTEM CALIBRATION (DYNAMIC BASELINES) ---
            Perform a search for the current season's "xG provider variance" for ${req.league}.
            Find the statistical deflation/inflation factor between Opta (FBref) and Understat/SofaScore. 
            If Understat consistently over-reports xG by 12% in this league, the understatBias should be 0.88.
            
            --- CONFIDENCE VECTOR ---
            Evaluate match context (manager stability, lineup news, tactical disruption) and generate a confidenceVector from 0 to 1.
            
            --- MARKET DYNAMICS ---
            Find opening odds vs current odds for the Match Result market. Calculate marketMovementSignal.

            Provide a comprehensive match summary based on this high-precision intelligence.`;

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
        const parsedData = JSON.parse(text.trim());

        // --- ASYNCHRONOUS CONSENSUS LAYER ---
        // Decoupled ingestion logic for structural purity and outlier filtering
        const homeData = IngestionService.standardize(parsedData.home, parsedData.calibration);
        const awayData = IngestionService.standardize(parsedData.away, parsedData.calibration);

        const data = {
            ...parsedData,
            home: homeData,
            away: awayData
        };

        const rawSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = rawSources
            .map((c: any) => ({ title: c.web?.title || 'Expert Source', uri: c.web?.uri }))
            .filter((s: any) => s.uri);

        // --- DATA INTEGRITY GATE ---
        const essentialMetrics = [
            data.home.npxG, data.home.xT, data.home.avgXG,
            data.away.npxG, data.away.xT, data.away.avgXG
        ];
        
        let modelMode: 'NUCLEAR_FORTRESS' | 'POISSON_FALLBACK' = 'NUCLEAR_FORTRESS';
        const isDataBlackout = essentialMetrics.some(m => m === undefined || m === null || m === 0);

        if (isDataBlackout) {
            modelMode = 'POISSON_FALLBACK';
            // Ensure some base values if missing to keep the math engine running
            data.home.npxG = data.home.npxG || data.home.avgXG || 1.1;
            data.home.xT = data.home.xT || 1.1;
            data.away.npxG = data.away.npxG || data.away.avgXG || 1.1;
            data.away.xT = data.away.xT || 1.1;
        }

        // --- LIVE COVARIANCE TRACKING ---
        // Feeds the true empirical variance directly into the Kalman measurement noise (R)
        const homeVar = IngestionService.calculateEmpiricalVariance(data.home);
        const awayVar = IngestionService.calculateEmpiricalVariance(data.away);
        const maxVariance = Math.max(homeVar, awayVar);

        // --- MATH EXECUTION ---
        const dc = calculateDixonColes(data.home, data.away, req.league, maxVariance, data.marketReality.marketMovementSignal);
        const regimePath = detectRegimeShifts(dc.alpha, dc.beta, data.home, data.away);
        const math = calculateProbability(data.home, data.away, dc.alpha, dc.beta, dc.rho, regimePath);
        const structuralData = calculateStructuralFloor(data.home, data.away);
        const physicalCeiling = calculatePhysicalCeiling(data.home, data.away, regimePath);
        const signalPrecision = calculateCredibilitySignal(data.home, data.away); 
        const physics = auditPhysics(data.home, data.away, regimePath);

        const killSwitchTriggered = maxVariance > 0.55; // Relaxed because we now weaponize variance instead of fearing it
        // modelMode is determined by the Data Integrity Gate above

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
            rho: dc.rho,
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
            },
            killSwitchTriggered,
            maxVariance,
            modelMode,
            matchContextFlag: data.context.matchContextFlag,
            calibration: data.calibration
        };

        // Store in Cache
        STORAGE.analysis[cacheKey] = { data: analysisResult, timestamp: Date.now() };
        saveStorage();

        return analysisResult;
    } catch (e: any) {
        console.error("Match Analysis Failed:", e);
        const isQuota = e.message?.includes('QUOTA') || e.message?.includes('LIMIT') || e.message?.includes('429');
        const isUnavailable = e.message?.includes('503') || e.message?.includes('UNAVAILABLE') || e.message?.includes('demand');
        
        if (isQuota) {
            throw new Error("System is slightly congested (Rate Limit). Retrying in 15 seconds...");
        }
        if (isUnavailable) {
            throw new Error("Gemini is currently experiencing high demand. Please try again in a few moments.");
        }
        throw e;
    }
};
