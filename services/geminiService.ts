
import { GoogleGenAI, Type } from "@google/genai";
import { 
    calculateProbability, 
    detectRegimeShifts, 
    calculateStructuralFloor,
    calculatePhysicalCeiling,
    calculateDixonColes,
    calculateCredibilitySignal,
    auditPhysics,
    TeamStats,
    RegimeState
} from "./mathUtils";

const MODEL_NAME = 'gemini-3-flash-preview'; 

export interface MatchContext {
    weather: string;
    referee: string;
    stadium: string;
    historicalRivalry: number;
    stakes: string;
}

export interface MarketReality {
    syndicateFlow: "HIGH" | "MEDIUM" | "LOW";
    smartMoneyTarget: string;
    marketDivergence: number;
    sentimentScore: number;
}

export interface MirrorMatch {
    match: string;
    result: string;
    similarityScore: number;
}

export interface ProsecutionCase {
    contradictions: string[];
    riskScore: number;
}

export interface AnalysisResult {
    probability: number;
    summary: string;
    homeStats: TeamStats;
    awayStats: TeamStats;
    sources: { title: string; uri: string }[];
    homeXG: number;
    awayXG: number;
    regimePath: RegimeState[];
    structuralFloor: number;
    physicalCeiling: number;
    structuralData: { floor: number, cushion: number };
    signalPrecision: number;
    physics: { metAudit: boolean, saturation: number };
    context: MatchContext;
    marketReality: MarketReality;
    mirrorMatches: MirrorMatch[];
    prosecution: ProsecutionCase;
}

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

export const findUpcomingGames = async (league: string, timeframe: string): Promise<{ home: string; away: string; kickoff: string; }[]> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        return [];
    }
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date().toISOString();
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Find 5 upcoming high-profile football matches in the ${league} for the timeframe: ${timeframe}. 
            The current system time is ${now}.
            ONLY return matches that have NOT started yet.
            Provide the home team, away team, and kickoff time (in UTC).`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            home: { type: Type.STRING },
                            away: { type: Type.STRING },
                            kickoff: { type: Type.STRING }
                        },
                        required: ["home", "away", "kickoff"]
                    }
                }
            }
        });
        const text = response.text;
        if (!text) {
            return [];
        }
        return JSON.parse(text.trim());
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const performAnalysis = async (req: { homeTeam: string; awayTeam: string; league: string; kickoff: string; }): Promise<AnalysisResult> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required for forensic auditing.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date().toISOString();
    try {
        const prompt = `Analyze the upcoming football match: ${req.homeTeam} vs ${req.awayTeam} in ${req.league}.
        Kickoff: ${req.kickoff}. Current time: ${now}.
        
        1. SIPHON: Pull detailed stats for both teams. 
           CRITICAL: You MUST find the 'Steel Data' - npxG (Non-penalty xG) and xT (Expected Threat). 
           Also pull goals, xG, xGA, form, and clean sheets.
        2. ANCESTRAL LAW (Mirror Matches): Find 3-5 historical matches (across any league/time) that share the same 'Steel' profile and Contextual Friction. Return their outcomes.
        3. THE PROSECUTION (Inversion): Build a case against high-confidence structural estimates. List every logical reason (contradictions) why this match could deviate from the dominant probability (e.g. specific referee trends, stadium quirks, travel fatigue). Give a risk score (0-100).
        4. EXTERNAL AUDIT: Analyze context (weather, referee, stadium, rivalry, stakes).
        5. MARKET REALITY: Forensic audit of Syndicate Flow (Starlizard/Smart Money), Market Divergence, and Sentiment Shadow.
        
        Provide a detailed match summary based on these layers.`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: analysisSchema
            },
        });

        const text = response.text;
        if (!text) {
            throw new Error("The Forensic Siphon failed to return a valid data stream. The match DNA may be blocked or unavailable.");
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

        return {
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
            prosecution: data.prosecution
        };
    } catch (e: any) {
        console.error("Analysis Failed:", e);
        throw e;
    }
};
