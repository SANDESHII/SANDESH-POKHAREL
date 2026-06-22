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
    runWeightedFeatureAudit,
    calculateShannonEntropy,
    calculateEVTRisk,
    calibrateMatchParameters
} from "./src/services/mathUtils";
import { findTopTacticalPaths } from "./src/services/viterbiService";
import { calculateDynamicRho, calculateMarketConfidence } from "./src/services/marketDataService";
import { IngestionService } from "./src/services/ingestionService";
import { getTeamBaseline } from "./src/services/baselineDataService";
import { AnalysisResult } from "./src/types";

const CORE_MODEL = 'gemini-3.5-flash'; 
const SEARCH_MODEL = 'gemini-3.5-flash'; 
const FALLBACK_MODEL = 'gemini-3.5-flash'; 
const LIGHT_MODEL = 'gemini-3.1-flash-lite'; 
const CACHE_FILE = path.join(process.cwd(), 'match_cache.json');

// --- ADVANCED NETWORK INTELLIGENCE ---
interface CircuitState {
    exhaustedUntil: number;
    congestedUntil: number;
    failureCount: number;
    lastFailureType?: 'QUOTA' | 'NETWORK' | 'LOGIC';
    searchExhaustedUntil?: number;
}

// In-memory grounding cache to preserve search quota
const GROUNDING_CACHE: Record<string, { data: any, timestamp: number }> = {};
const GROUNDING_TTL = 30 * 60 * 1000; // 30 minutes

const getMatchCacheKey = (req: { homeTeam: string; awayTeam: string; league: string }) => {
    return `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase().replace(/\s+/g, '');
};

let modelHealth: Record<string, CircuitState> = {
    ['gemini-3.5-flash']: { exhaustedUntil: 0, congestedUntil: 0, failureCount: 0 },
    ['gemini-3.1-flash-lite']: { exhaustedUntil: 0, congestedUntil: 0, failureCount: 0 }
};

let groundingCongestedUntil = 0;
let systemHealthStatus: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL' = 'OPTIMAL';

let systemPressure = 0; // 0 to 10
const MAX_PRESSURE = 10;

// Automatic Pressure Decay
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        if (systemPressure > 0) {
            systemPressure = Math.max(0, systemPressure - 1);
            console.log(`[SYSTEM] Pressure decaying naturally. Now: ${systemPressure}/10`);
        }
    }, 60000); // 1 minute decay cycle (was 3)
}

const isModelHealthy = (model: string, needsSearch: boolean = false) => {
    const health = modelHealth[model];
    if (!health) return systemPressure < MAX_PRESSURE;
    const now = Date.now();
    
    // Model level check
    if (now <= health.exhaustedUntil || now <= health.congestedUntil) return false;
    
    // Search level check
    if (needsSearch && (now <= groundingCongestedUntil || (health.searchExhaustedUntil && now <= health.searchExhaustedUntil))) return false;
    
    // Search specifically has a lower pressure threshold but we increase it
    if (needsSearch && systemPressure >= 6) return false;
    
    return systemPressure < MAX_PRESSURE;
};

const markSearchExhausted = (model: string, durationMs: number = 30000) => {
    if (!modelHealth[model]) {
        modelHealth[model] = { exhaustedUntil: 0, congestedUntil: 0, failureCount: 0 };
    }
    
    // Incrementally lock search longer if repeated failures
    const health = modelHealth[model];
    const lockExtension = (health.failureCount || 0) * 60000;
    const finalDuration = durationMs + lockExtension;
    
    console.warn(`[CIRCUIT_BREAKER] ${model} SEARCH QUOTA reached. Locking search for ${finalDuration / 1000}s (Extension: ${lockExtension/1000}s)`);
    groundingCongestedUntil = Date.now() + finalDuration;
    modelHealth[model].searchExhaustedUntil = Date.now() + finalDuration;
    saveStorage();
};

const markModelExhausted = (model: string, durationMs: number = 30000) => { 
    if (!modelHealth[model]) {
        modelHealth[model] = { exhaustedUntil: 0, congestedUntil: 0, failureCount: 0 };
    }
    systemPressure = Math.min(MAX_PRESSURE, systemPressure + 2);
    console.warn(`[CIRCUIT_BREAKER] ${model} EXHAUSTED (Quota hit). Pressure: ${systemPressure}/10. Locking for ${durationMs / 1000}s`);
    modelHealth[model].exhaustedUntil = Date.now() + durationMs;
    modelHealth[model].lastFailureType = 'QUOTA';
    saveStorage();
};

const markModelCongested = (model: string, durationMs: number = 5000) => {
    if (!modelHealth[model]) {
        modelHealth[model] = { exhaustedUntil: 0, congestedUntil: 0, failureCount: 0 };
    }
    systemPressure = Math.min(MAX_PRESSURE, systemPressure + 1);
    console.warn(`[CIRCUIT_BREAKER] ${model} CONGESTED (503/Timeout). Pressure: ${systemPressure}/10. Locking for ${durationMs / 1000}s`);
    modelHealth[model].congestedUntil = Date.now() + durationMs;
    modelHealth[model].failureCount++;
    modelHealth[model].lastFailureType = 'NETWORK';
    saveStorage();
};

// --- DURABLE CACHE (File-based Persistence) ---
interface DurableCache {
    analysis: Record<string, { data: AnalysisResult, timestamp: number }>;
    health?: Record<string, CircuitState>;
    groundingCongestedUntil?: number;
}

let STORAGE: DurableCache = { analysis: {} };

const loadStorage = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf-8');
            STORAGE = JSON.parse(data);
            
            // Restore health states
            if (STORAGE.health) {
                Object.assign(modelHealth, STORAGE.health);
                // Cleanse legacy models
                Object.keys(modelHealth).forEach(m => {
                    if (m.includes('1.5')) delete modelHealth[m];
                });
            }
            if (STORAGE.groundingCongestedUntil) {
                groundingCongestedUntil = STORAGE.groundingCongestedUntil;
            }
            
            console.log("Match Report Pro: Knowledge & Health State Restored.");
        }
    } catch (e) {
        console.error("Knowledge Base Corrupted. Resetting.", e);
    }
};

const saveStorage = () => {
    try {
        STORAGE.health = modelHealth;
        STORAGE.groundingCongestedUntil = groundingCongestedUntil;
        fs.writeFileSync(CACHE_FILE, JSON.stringify(STORAGE, null, 2));
    } catch (e) {
        console.error("State Serialization Failure:", e);
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
    private minDelay = 2000; // Increased base delay
    private searchDelay = 15000; // Increased search delay
    private coolingDownUntil = 0;
    private onStatusChange?: (status: { depth: number; isCoolingDown: boolean; cooldownRemaining: number; message?: string }) => void;

    setCallback(cb: (status: { depth: number; isCoolingDown: boolean; cooldownRemaining: number; message?: string }) => void) {
        this.onStatusChange = cb;
    }

    private emitStatus(message?: string) {
        if (!this.onStatusChange) return;
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((this.coolingDownUntil - now) / 1000));
        this.onStatusChange({
            depth: this.queue.length,
            isCoolingDown: now < this.coolingDownUntil,
            cooldownRemaining: remaining,
            message
        });
    }

    private getDynamicDelay(useSearch: boolean): number {
        const baseDelay = useSearch ? this.searchDelay : this.minDelay;
        // Scale delay based on system pressure: pressure 2 doubles it, pressure 5 triples it, etc.
        const multiplier = 1 + (systemPressure * 0.5); 
        return baseDelay * multiplier;
    }

    async add<T>(task: (context: { model: string }) => Promise<T>, model: string, useSearch = false, retries = 0): Promise<T> {
        return new Promise((resolve, reject) => {
            if (useSearch && Date.now() < groundingCongestedUntil) {
                reject(new Error(`SEARCH_COOLDOWN`));
                return;
            }

            this.queue.push(async () => {
                let attempt = 0;
                this.emitStatus();
                while (attempt <= retries) {
                    try {
                        const now = Date.now();
                        const delay = this.getDynamicDelay(useSearch);
                        const waitTime = Math.max(0, this.lastRequestTime + delay - now);
                        
                        if (waitTime > 0 || now < this.coolingDownUntil) {
                            const totalWait = Math.max(waitTime, this.coolingDownUntil - now);
                            await new Promise(r => setTimeout(r, totalWait));
                        }
                        
                        this.emitStatus(attempt > 0 ? `Retrying... (${attempt}/${retries})` : undefined);
                        const result = await task({ model });
                        this.lastRequestTime = Date.now();
                        
                        if (modelHealth[model]) {
                            modelHealth[model].failureCount = 0;
                            systemPressure = Math.max(0, systemPressure - 1);
                        }
                        
                        resolve(result);
                        this.emitStatus();
                        return;
                    } catch (err: any) {
                        const errMessage = (err.message || "").toLowerCase();
                        const isRateLimit = err.status === 429 || err.code === 429 || errMessage.includes('429') || errMessage.includes('quota') || errMessage.includes('limit');
                        const isUnavailable = err.status === 503 || err.code === 503 || errMessage.includes('503') || errMessage.includes('unavailable') || errMessage.includes('high demand') || errMessage.includes('congested');
                        const isSearchLimit = errMessage.includes('search_limit_hit') || errMessage.includes('searching') || errMessage.includes('grounding');
                        const isNotFound = err.status === 404 || err.code === 404 || errMessage.includes('404') || errMessage.includes('not found');
                        
                        if (isNotFound) {
                            markModelExhausted(model, 1000); 
                            reject(new Error(`MODEL_NOT_FOUND: ${model}`));
                            return;
                        }

                        if (isSearchLimit || (isRateLimit && useSearch) || (useSearch && errMessage.includes('quota'))) {
                            markSearchExhausted(model, 300000); // 5 mins search lockout for stability
                            if (attempt >= retries) {
                                reject(new Error("SEARCH_QUOTA_EXCEEDED"));
                                return;
                            }
                        } else if (isRateLimit) {
                            const isHardLimit = errMessage.includes('limit: 0');
                            markModelExhausted(model, isHardLimit ? 3600000 : 30000); 
                            if (isHardLimit || attempt >= retries) {
                                reject(new Error(isHardLimit ? "MODEL_EXHAUSTED" : "QUOTA_EXCEEDED"));
                                return;
                            }
                        }

                        if (isUnavailable) {
                            markModelCongested(model, 15000); 
                            if (useSearch && attempt >= retries) {
                                reject(new Error("SEARCH_MODEL_CONGESTED"));
                                return;
                            }
                        }

                        if ((isRateLimit || isUnavailable) && attempt < retries) {
                            attempt++;
                            let jitter = Math.random() * 1000;
                            let backoff = (Math.pow(2, attempt) * 4000) + jitter; 
                            this.coolingDownUntil = Date.now() + backoff;
                            console.warn(`[RETRY] Gemini Failure (${isRateLimit ? '429' : '503'}): Backing off for ${Math.round(backoff/1000)}s... Attempt ${attempt}/${retries}`);
                            await new Promise(r => setTimeout(r, backoff));
                            continue;
                        }
                        reject(err);
                        this.emitStatus();
                        return;
                    }
                }
            });
            this.emitStatus();
            this.process();
        });
    }

    get state() {
        const isCooling = Date.now() < this.coolingDownUntil;
        return {
            depth: this.queue.length,
            isCoolingDown: isCooling,
            cooldownRemaining: Math.max(0, Math.ceil((this.coolingDownUntil - Date.now()) / 1000)),
            message: isCooling ? "System Throttled" : (this.queue.length > 0 ? "Processing Queue" : "Ready")
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
    defensiveStability: { type: Type.NUMBER, description: "0.0 (leaky) to 1.0 (impenetrable) metric" },
    offensiveVolatility: { type: Type.NUMBER, description: "0.0 (consistent) to 1.0 (erratic/explosive) metric" },
    xT: { type: Type.NUMBER, description: "Expected Threat (Steel Data)" },
    form: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    cleanSheets: { type: Type.NUMBER },
    redCardAnomalyMinutes: { type: Type.NUMBER, description: "Minutes played with a red card in last 3 games" },
    managerSacked: { type: Type.BOOLEAN, description: "Has the manager been sacked/changed this week?" },
    injuryCount: { type: Type.NUMBER, description: "Number of starting XI players confirmed out" },
    missingExpectedG: { type: Type.NUMBER, description: "Sum of average xG contributions from confirmed out players" },
    missingExpectedT: { type: Type.NUMBER, description: "Sum of average xT contributions from confirmed out players" },
    missingPlayersList: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of names of starting XI players confirmed out" },
    npxGSequence: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Last 10 match npxG values for recursive state warming" },
    xGASequence: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Last 10 match xGA values for recursive state warming" },
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
        },
        description: "Recent match history for exponential time-decay calibration"
    }
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
        matchSummary: { 
            type: Type.STRING, 
            description: "Forensic analysis summary. START with 'Forensic Ingestion: Raw team data is ingested and routed through a hardened Gemini 3 Flash Preview grounded search...'" 
        },
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
                calibrationConfidence: { type: Type.NUMBER },
                aiStructuralFloor: { type: Type.NUMBER, description: "AI suggested goal floor (e.g. 1.0 for under 1.5 matches)" },
                aiPhysicalCeiling: { type: Type.NUMBER, description: "AI suggested goal ceiling (e.g. 3.5 for fortress matches)" }
            },
            required: ["understatBias", "sofaScoreBias", "calibrationConfidence"]
        },
        ingestedDataSummary: { type: Type.STRING, description: "A high-level summary of the raw data sources and team news found during search to prove ingestion." }
    },
    required: ["home", "away", "context", "marketReality", "matchSummary", "mirrorMatches", "prosecution", "calibration", "ingestedDataSummary"]
};

// --- HELPER LOGIC ---

const generateAnalysisPrompt = (req: { homeTeam: string; awayTeam: string; league: string; kickoff: string; }, now: string, baselines?: { home?: any, away?: any }, isSearchEnabled: boolean = true) => {
    let baselineContext = "";
    if (baselines?.home || baselines?.away) {
        baselineContext = `\n--- VERIFIED_INSTITUTIONAL_BASELINES ---\n`;
        if (baselines.home) baselineContext += `${req.homeTeam}: npxG=${baselines.home.npxG}, xT=${baselines.home.xT}, avgXG=${baselines.home.avgXG}, avgXGA=${baselines.home.avgXGA}, CS=${baselines.home.cleanSheets}\n`;
        if (baselines.away) baselineContext += `${req.awayTeam}: npxG=${baselines.away.npxG}, xT=${baselines.away.xT}, avgXG=${baselines.away.avgXG}, avgXGA=${baselines.away.avgXGA}, CS=${baselines.away.cleanSheets}\n`;
        baselineContext += `INSTRUCTION: Use these baselines as anchor points. Reconcile with latest news/lineups to identify immediate variance.\n`;
    }

    const searchInstruction = isSearchEnabled 
        ? "GROUNDING: Use Google Search to find latest starting XIs, tactical shifts, and motivation." 
        : "GROUNDING: Web Search is restricted. SYNTHESIZE analysis using ONLY the provided Institutional Baselines and historical league knowledge.";

    return `INSTRUCTION: PERFORM_FORENSIC_DATA_INGESTION for ${req.homeTeam} vs ${req.awayTeam} (${req.league}).
    Kickoff: ${req.kickoff}. Reference Time: ${now}.
    
    DATA_INGESTION_LOCK: You MUST verify the existence of this specific match on today's date (${now.split('T')[0]}) or the closest upcoming date. 
    If the match does not exist under these names, search for common variations.
    
    ${baselineContext}
    ${searchInstruction}

    PRIMARY MISSION: Extract and "SIPHON" data into the following mathematical categories:
    
    --- REQUIRED_DATA_POINTS (SIPHON_TARGETS) ---
    1. LATEST_TEAM_NEWS (Attacking/Defensive Impact): Identify missing starters. Siphon into xG variance.
    2. TACTICAL_SHIFT (Game State): Siphon into 'regimePath' intensities.
    3. ENVIRONMENTAL_FACTORS: MANDATORY fetch Matchday Weather (Ingest into 'context.weather') and Referee tendencies (Ingest into 'context.referee').
    4. MOTIVATIONAL_INDEX: Siphon into 'stakes' and 'confidenceVector'.
    5. GOAL_BOTTLENECKS: Siphon into 'structuralFloor' vs 'physicalCeiling' anchors.
    
    --- OUTPUT_DISCIPLINE ---
    - Use Baselines as the mathematical floor.
    - RETURN_RAW_JSON_ONLY. No prose. No markdown blocks.`;
};

export const getQueueState = () => ({
    ...matchQueue.state,
    systemPressure,
    groundingCongestedUntil
});

// --- EMERGENCY FAILOVER SYSTEM ---
const generatePseudoAnalysis = (req: { homeTeam: string; awayTeam: string; league: string }): AnalysisResult => {
    console.warn(`[EMERGENCY] Initiating Self-Healing Pseudo-Analysis for ${req.homeTeam} vs ${req.awayTeam}`);
    
    // Retrieve pre-calibrated baseline archives
    const home = getTeamBaseline(req.homeTeam);
    const away = getTeamBaseline(req.awayTeam);
    
    // Standardize and Calibrate
    const hProcessed = IngestionService.standardize({ ...home, name: req.homeTeam }, { understatBias: 1, sofaScoreBias: 1 });
    const aProcessed = IngestionService.standardize({ ...away, name: req.awayTeam }, { understatBias: 1, sofaScoreBias: 1 });

    const dc = calculateDixonColes(hProcessed, aProcessed, req.league, 0.2, 0);
    const regime = detectRegimeShifts(dc.alpha, dc.beta, hProcessed, aProcessed);
    const math = calculateProbability(hProcessed, aProcessed, dc.alpha, dc.beta, dc.rho, regime);
    
    const floorRaw = calculateStructuralFloor(hProcessed, aProcessed);
    const ceilingRaw = calculatePhysicalCeiling(hProcessed, aProcessed, regime);

    return {
        probability: math.probability,
        summary: `[HEALED] Forensic analysis derived from Institutional Archives. Our real-time data ingestion stream is currently experiencing high network pressure (Congestion). We have automatically failed over to high-fidelity structural baselines to ensure analytical continuity. Probabilities are anchored to historical performance vectors and calibrated decay models.`,
        homeStats: hProcessed,
        awayStats: aProcessed,
        sources: [{ title: "Institutional Archive", uri: "#" }],
        homeXG: dc.alpha,
        awayXG: dc.beta,
        rho: dc.rho,
        regimePath: regime,
        structuralFloor: floorRaw.floor,
        physicalCeiling: ceilingRaw,
        structuralData: floorRaw,
        signalPrecision: 0.75, // Lowered precision for fallback
        physics: { metAudit: dc.alpha + dc.beta > 2.0, saturation: Math.max(0.2, 0.6 - ((dc.alpha + dc.beta) * 0.1)), integrityScore: 0.8 },
        context: { weather: "Standard", referee: "Neutral", stadium: "Neutral", historicalRivalry: 0.3, stakes: "Standard", confidenceVector: 0.7 },
        marketReality: { syndicateFlow: "MEDIUM", smartMoneyTarget: "Equilibrium", marketDivergence: 0.0, sentimentScore: 0.5, openingOdds: { home: 2.0, draw: 3.4, away: 3.6 }, currentOdds: { home: 2.0, draw: 3.4, away: 3.6 }, marketMovementSignal: 0 },
        mirrorMatches: [],
        prosecution: { contradictions: ["Signal derived from statistical baselines"], riskScore: 0.3 },
        modelAudit: { bayesianPoisson: 0.75, weightedFeatureSignal: 0.75, recursiveFilterMomentum: 0.75, entropy: 0.75, evtRisk: 0.75 },
        killSwitchTriggered: false,
        maxVariance: 0.2,
        modelMode: 'POISSON_FALLBACK',
        matchContextFlag: 'Standard',
        calibration: { understatBias: 1, sofaScoreBias: 1, calibrationConfidence: 0.6 },
        groundingStatus: 'DEGRADED',
        ingestedDataSummary: "Emergency fallback to Institutional Baselines. Real-time search data stream is currently restricted by system congestion."
    };
};

export const performAnalysis = async (req: { homeTeam: string; awayTeam: string; league: string; kickoff: string; }): Promise<AnalysisResult> => {
    const ai = getAI();
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const cacheKey = `analysis-${req.homeTeam}-${req.awayTeam}-${req.kickoff}`.toLowerCase();

    // Check Analysis Cache
    const cached = STORAGE.analysis[cacheKey];
    
    // Dynamic Cache Window: Extend if system is under pressure to save quota
    const effectiveTTL = systemPressure >= 4 ? ANALYSIS_CACHE_TTL * 4 : ANALYSIS_CACHE_TTL;
    
    if (cached && (Date.now() - cached.timestamp < effectiveTTL)) {
        console.log(`Cache: Returning ${systemPressure >= 4 ? 'EXTENDED ' : ''}cached analysis for ${req.homeTeam} vs ${req.awayTeam}`);
        return cached.data;
    }

    try {
        // Retrieve Institutional Baselines for Smart Routing
        const homeBaseline = getTeamBaseline(req.homeTeam);
        const awayBaseline = getTeamBaseline(req.awayTeam);
        const isWellKnownMatchup = (homeBaseline.cleanSheets > 8 && awayBaseline.cleanSheets > 8) || 
                                   (homeBaseline.avgXG > 1.8 && awayBaseline.avgXG > 1.8);

        const prompt = generateAnalysisPrompt(req, now, { home: homeBaseline, away: awayBaseline });
        const fallbackToStaleCache = () => {
            if (cached) {
                console.warn(`[RECOVERY] Returning STALE cache due to network congestion for ${req.homeTeam} vs ${req.awayTeam}`);
                return cached.data;
            }
            return null;
        };

        const matchCacheKey = getMatchCacheKey(req);
        const cachedGrounding = GROUNDING_CACHE[matchCacheKey];
        const isGroundingCached = cachedGrounding && (Date.now() - cachedGrounding.timestamp < GROUNDING_TTL);

        // --- SURVIVAL BYPASS: If system pressure is critical, don't even try the API ---
        if (systemPressure >= 6) {
            console.warn(`[SURVIVAL] System pressure (${systemPressure}/10) is CRITICAL. Fast-tracking Pseudo-Analysis.`);
            return generatePseudoAnalysis(req);
        }

        // Update system health status
        systemHealthStatus = nowMs > groundingCongestedUntil ? 'OPTIMAL' : 'DEGRADED';

        // Heuristic: Skip search if system is slightly pressured, matchup is well-known, or results are cached
        const strategies = [
            { 
                name: 'FORENSIC_GROUNDING_3.0', 
                model: 'gemini-3.5-flash', 
                config: { tools: [{ googleSearch: {} }] }, 
                enableSearch: true,
                retries: 1, // Reduced retries for search to fail fast and move to core
                active: nowMs > groundingCongestedUntil && !isWellKnownMatchup && !isGroundingCached && systemPressure < 4
            },
            { 
                name: 'INSTITUTIONAL_CORE_3.0', 
                model: 'gemini-3.5-flash', 
                config: {}, 
                enableSearch: false,
                retries: 2, 
                active: systemPressure < 8
            },
            { 
                name: 'SAFE_HARBOR_LITE', 
                model: 'gemini-3.1-flash-lite', 
                config: {}, 
                enableSearch: false,
                retries: 3, 
                active: true 
            }
        ];

        let response;
        let lastError;
        let groundingStatus: 'OPTIMAL' | 'DEGRADED' | 'FAILED' | 'QUOTA_EXCEEDED' | 'SEARCH_COOLDOWN' = 'FAILED';

        for (const strategy of strategies) {
            // Check health specifically for the needs of the strategy
            const isHealthy = isModelHealthy(strategy.model, strategy.enableSearch);
            const isSearchBlocked = strategy.enableSearch && Date.now() < groundingCongestedUntil;

            if (!strategy.active || !isHealthy || (strategy.enableSearch && isSearchBlocked)) {
                if (strategy.enableSearch && isSearchBlocked) {
                    groundingStatus = 'SEARCH_COOLDOWN';
                }
                console.log(`[ROUTING] Skipping ${strategy.name}: ${!strategy.active ? 'Inactive' : isSearchBlocked ? 'Search Blocked' : 'Model not healthy'}`);
                continue;
            }

            try {
                console.log(`[ROUTING] Attempting strategy: ${strategy.name} (Search: ${strategy.enableSearch})`);
                
                response = await matchQueue.add(async ({ model }) => {
                    let finalPrompt = generateAnalysisPrompt(req, now, { home: homeBaseline, away: awayBaseline }, strategy.enableSearch);
                    
                    // If we have cached grounding, inject it as context to avoid a new search
                    if (strategy.name === 'CACHED_GROUNDING_REFRESH' && isGroundingCached) {
                        finalPrompt += `\n\n--- CACHED_MATCH_INTELLIGENCE ---\n${JSON.stringify(cachedGrounding.data)}\n`;
                    }

                    const result = await ai.models.generateContent({
                        model,
                        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
                        config: {
                            ...strategy.config,
                            responseMimeType: "application/json",
                            responseSchema: analysisSchema as any
                        }
                    });
                    
                    return result;
                }, strategy.model, strategy.enableSearch, strategy.retries);
                
                // Success - break the strategy loop
                console.log(`[ROUTING] Strategy ${strategy.name} succeeded.`);
                
                // POPULATE GROUNDING CACHE if search was successful
                if (strategy.enableSearch && response) {
                    GROUNDING_CACHE[matchCacheKey] = {
                        data: response, // Cache the whole response for context injection
                        timestamp: Date.now()
                    };
                }

                if (strategy.name === 'FORENSIC_GROUNDING_3.0') {
                    groundingStatus = 'OPTIMAL';
                } else if (groundingStatus !== 'QUOTA_EXCEEDED' && groundingStatus !== 'SEARCH_COOLDOWN') {
                    groundingStatus = 'DEGRADED';
                }
                break;
            } catch (err: any) {
                lastError = err;
                const msg = err.message || JSON.stringify(err);
                
                if (strategy.enableSearch && (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('congested') || msg.toLowerCase().includes('grounding') || msg.toUpperCase().includes('QUOTA_EXCEEDED') || msg.toUpperCase().includes('SEARCH_QUOTA'))) {
                    console.warn(`[ROUTING] Grounding specifically congested (${msg}). Moving to next strategy...`);
                    groundingStatus = (msg.toUpperCase().includes('QUOTA') || msg.toUpperCase().includes('SEARCH_QUOTA')) ? 'QUOTA_EXCEEDED' : 'FAILED';
                } else {
                    console.warn(`[ROUTING] Strategy ${strategy.name} failed: ${msg}`);
                }
                
                // Allow loop to proceed to next strategy
                continue;
            }
        }

        // --- SURVIVAL LAYER: If no response was generated, use pseudo-analysis as final fallback ---
        if (!response) {
            console.warn("[SURVIVAL] All strategies failed or skipped. Falling back to Forensic Pseudo-Analysis.");
            const stale = fallbackToStaleCache();
            if (stale) return stale;
            return generatePseudoAnalysis(req);
        }

        const text = typeof response.text === 'function' ? response.text() : response.text;
        if (!text) {
            throw new Error("Match analysis failed: Data stream empty.");
        }
        const parsedData = JSON.parse(text.trim());

        // RIGID SCHEMA CLAMPING: Eliminating data noise and physically impossible outliers
        const structuralFloor = 0.2;
        const physicalCeiling = 4.5;
        const clampXG = (val: number) => Math.max(structuralFloor, Math.min(val || structuralFloor, physicalCeiling));

        if (parsedData.home) {
            parsedData.home.avgXG = clampXG(parsedData.home.avgXG);
            parsedData.home.avgXGA = clampXG(parsedData.home.avgXGA);
            parsedData.home.npxG = clampXG(parsedData.home.npxG);
        }
        if (parsedData.away) {
            parsedData.away.avgXG = clampXG(parsedData.away.avgXG);
            parsedData.away.avgXGA = clampXG(parsedData.away.avgXGA);
            parsedData.away.npxG = clampXG(parsedData.away.npxG);
        }

        const rawSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const searchEntry = response.candidates?.[0]?.groundingMetadata?.searchEntryPoint?.htmlContent;
        const sources = rawSources
            .map((c: any) => ({ title: c.web?.title || 'Expert Source', uri: c.web?.uri }))
            .filter((s: any) => s.uri);

        // --- ASYNCHRONOUS CONSENSUS LAYER ---
        const homeData = IngestionService.standardize(parsedData.home, parsedData.calibration);
        const awayData = IngestionService.standardize(parsedData.away, parsedData.calibration);

        const data: AnalysisResult = {
            ...parsedData,
            summary: parsedData.matchSummary,
            homeStats: homeData,
            awayStats: awayData,
            sources,
            modelMode: parsedData.modelMode || 'POISSON_FALLBACK'
        };

        // --- DATA INTEGRITY GATE ---
        const essentialMetrics = [
            data.homeStats.npxG, data.homeStats.xT, data.homeStats.avgXG,
            data.awayStats.npxG, data.awayStats.xT, data.awayStats.avgXG
        ];
        
        let modelMode: 'NUCLEAR_FORTRESS' | 'POISSON_FALLBACK' = 'NUCLEAR_FORTRESS';
        const isDataBlackout = essentialMetrics.some(m => m === undefined || m === null || m === 0);

        if (isDataBlackout) {
            modelMode = 'POISSON_FALLBACK';
            // Ensure some base values if missing to keep the math engine running
            data.homeStats.npxG = data.homeStats.npxG || data.homeStats.avgXG || 1.1;
            data.homeStats.xT = data.homeStats.xT || 1.1;
            data.awayStats.npxG = data.awayStats.npxG || data.awayStats.avgXG || 1.1;
            data.awayStats.xT = data.awayStats.xT || 1.1;
        }

        // --- LIVE COVARIANCE TRACKING ---
        // Feeds the true empirical variance directly into the Kalman measurement noise (R)
        const homeVar = IngestionService.calculateEmpiricalVariance(data.homeStats);
        const awayVar = IngestionService.calculateEmpiricalVariance(data.awayStats);
        const maxVariance = Math.max(homeVar, awayVar);

        // --- MATH EXECUTION ---
        const marketRho = calculateDynamicRho({
            openingDraw: data.marketReality.openingOdds.draw,
            currentDraw: data.marketReality.currentOdds.draw,
            openingHome: data.marketReality.openingOdds.home,
            currentHome: data.marketReality.currentOdds.home,
            openingAway: data.marketReality.openingOdds.away,
            currentAway: data.marketReality.currentOdds.away
        });
        
        const marketConfidenceAdj = calculateMarketConfidence({
            openingDraw: data.marketReality.openingOdds.draw,
            currentDraw: data.marketReality.currentOdds.draw,
            openingHome: data.marketReality.openingOdds.home,
            currentHome: data.marketReality.currentOdds.home,
            openingAway: data.marketReality.openingOdds.away,
            currentAway: data.marketReality.currentOdds.away
        });

        const refinedConfidence = Math.min(data.context.confidenceVector, marketConfidenceAdj);

        const dc = calculateDixonColes(
            data.homeStats, 
            data.awayStats, 
            req.league, 
            maxVariance, 
            data.marketReality.marketMovementSignal
        );
        
        // --- PATH PRUNING (VITERBI PROTOCOL) ---
        // We find the top 3 most likely game narratives and prune to the most statistically probable one.
        const topPaths = findTopTacticalPaths(dc.alpha, dc.beta, data.homeStats, data.awayStats, 3);
        const regimePath = topPaths[0].states;
        
        // Use the better Rho from Market Reality
        const finalRho = (marketRho + dc.rho) / 2;
        
        const math = calculateProbability(data.homeStats, data.awayStats, dc.alpha, dc.beta, finalRho, regimePath);
        const structuralData = calculateStructuralFloor(data.homeStats, data.awayStats);
        const physicalCeilingRaw = calculatePhysicalCeiling(data.homeStats, data.awayStats, regimePath);
        
        let finalFloor = data.calibration.aiStructuralFloor || structuralData.floor;
        let finalCeiling = data.calibration.aiPhysicalCeiling || physicalCeilingRaw;

        if (data.homeStats.matchHistory && data.awayStats.matchHistory) {
            const cal = calibrateMatchParameters(data.homeStats.matchHistory, data.awayStats.matchHistory);
            finalFloor = (finalFloor * 0.3) + (cal.structuralFloor * 0.7);
            finalCeiling = (finalCeiling * 0.3) + (cal.physicalCeiling * 0.7);
        }
        
        // Recalibrate based on AI confidence in bottlenecks
        if (data.calibration.aiStructuralFloor) finalFloor = (finalFloor + data.calibration.aiStructuralFloor) / 2;
        if (data.calibration.aiPhysicalCeiling) finalCeiling = (finalCeiling + data.calibration.aiPhysicalCeiling) / 2;


        const signalPrecision = calculateCredibilitySignal(data.homeStats, data.awayStats); 
        const physics = auditPhysics(data.homeStats, data.awayStats, regimePath);

        const killSwitchTriggered = maxVariance > 0.55; // Relaxed because we now weaponize variance instead of fearing it
        // modelMode is determined by the Data Integrity Gate above

        // Advanced Model Audits
        const bayesianHome = new BayesianPoissonAudit(data.homeStats.avgXG);
        const bayesianAway = new BayesianPoissonAudit(data.awayStats.avgXG);
        const bayesianPoisson = (bayesianHome.getSurety() + bayesianAway.getSurety()) / 2;
        
        const weightedAudit = runWeightedFeatureAudit(data.homeStats, data.awayStats);
        const entropy = (calculateShannonEntropy(data.homeStats) + calculateShannonEntropy(data.awayStats)) / 2;
        const evtRisk = calculateEVTRisk(data.homeStats, data.awayStats);
        
        // Momentum relevance is tied to the Signal Precision in this context
        const filterMomentum = signalPrecision;

        const analysisResult: AnalysisResult = {
            probability: math.probability,
            summary: data.summary,
            homeStats: data.homeStats,
            awayStats: data.awayStats,
            sources,
            homeXG: dc.alpha, 
            awayXG: dc.beta,  
            rho: finalRho,
            regimePath: regimePath,
            topTacticalPaths: topPaths,
            structuralFloor: finalFloor,
            physicalCeiling: finalCeiling,
            structuralData,
            signalPrecision,
            physics,
            context: { ...data.context, confidenceVector: refinedConfidence },
            marketReality: data.marketReality,
            mirrorMatches: data.mirrorMatches,
            prosecution: data.prosecution,
            modelAudit: {
                bayesianPoisson,
                weightedFeatureSignal: weightedAudit,
                recursiveFilterMomentum: filterMomentum,
                entropy,
                evtRisk
            },
            killSwitchTriggered,
            maxVariance,
            modelMode,
            matchContextFlag: data.matchContextFlag,
            calibration: data.calibration,
            groundingStatus,
            ingestedDataSummary: data.ingestedDataSummary
        };

        // Store in Cache
        STORAGE.analysis[cacheKey] = { data: analysisResult, timestamp: Date.now() };
        saveStorage();

        return analysisResult;
    } catch (e: any) {
        console.error("Match Analysis Failed:", e);
        const errStr = (e.message || JSON.stringify(e)).toLowerCase();
        
        // Final Level fallback if logic crashes or all else fails
        if (!errStr.includes('quota') && !errStr.includes('limit')) {
            try {
                console.warn("[RECOVERY] Hard Crash in performAnalysis - Returning Emergency Pseudo-Analysis");
                return generatePseudoAnalysis(req);
            } catch (inner) {}
        }

        const isQuota = errStr.includes('quota') || errStr.includes('limit') || errStr.includes('429');
        const isUnavailable = errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('demand') || errStr.includes('congested') || errStr.includes('overloaded');
        
        if (isQuota || isUnavailable) {
            try {
                console.warn(`[RECOVERY] ${isQuota ? 'Quota' : 'Congestion'} detected - returning emergency forensic baseline.`);
                return generatePseudoAnalysis(req);
            } catch (inner) {
                console.error("[RECOVERY] Internal failover crash:", inner);
            }
        }

        if (isQuota) {
            let retryMsg = "System is slightly congested (Rate Limit).";
            const match = errStr.match(/retry in ([\d.]+)s/i);
            if (match && match[1]) {
                retryMsg += ` Automatic retry in ${Math.ceil(parseFloat(match[1]))} seconds...`;
            } else {
                retryMsg += " High precision grounding is currently under heavy load. Retrying in 15 seconds...";
            }
            throw new Error(retryMsg);
        }
        
        if (isUnavailable) {
            throw new Error("The analysis engine is currently experiencing high demand (Congestion). We are automatically failing over to forensic baselines, but the real-time stream is blocked. Please try again in a few moments.");
        }
        throw e;
    }
};
