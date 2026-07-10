import { GoogleGenAI, Type } from "@google/genai";
import { MatchEngine } from "./src/services/engine";
import { IngestionService } from "./src/services/ingestionService";
import { getTeamBaseline } from "./src/services/baselineDataService";
import { AnalysisResult, MatchContext } from "./src/types";
import { TeamMatchInput } from "./src/ingestion/schema";
import { LiveOddsProvider } from "./src/ingestion/sources/liveOddsProvider";
import { WeatherProvider } from "./src/ingestion/sources/weatherProvider";

const PRIMARY_MODEL = 'gemini-3.5-flash'; 
const SECONDARY_MODEL = 'gemini-flash-latest';
const TERTIARY_MODEL = 'gemini-3.1-flash-lite';
const cache = new Map<string, { result: AnalysisResult, timestamp: number }>();
const CACHE_TTL = 30 * 1000; // Reduced to 30 seconds for higher dynamism

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
        predictionType: { type: Type.STRING, enum: ["OVER_15", "UNDER_35"] },
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
        },
        homeLineup: { type: Type.ARRAY, items: { type: Type.STRING } },
        awayLineup: { type: Type.ARRAY, items: { type: Type.STRING } },
        tacticalShift: { type: Type.STRING }
    },
    required: ["home", "away", "context", "marketIndicators", "matchSummary", "adjustment", "ingestedDataSummary", "homeLineup", "awayLineup", "tacticalShift"]
};

const SystemLog = (msg: string) => console.log(`[ANALYSIS_ENGINE] ${msg}`);

const SYSTEM_INSTRUCTION = `You are a Match Physics Quant. You analyze football games as a system of tactical energy and statistical entropy.
- YOU MUST PERFORM A REAL-TIME SEARCH for today's specific match data (confirmed/projected lineups, injuries, weather).
- ANALYZE THE DELTA: How does today's news change the baseline historical stats? (e.g. if a star defender is out, the 'defensiveStability' baseline must be lowered).
- Use specific tactical energy terms like 'CRITICAL-ROTATION', 'INJURY-CRISIS', 'ATTACKING-SHIFT', 'TACTICAL-REBOOT', 'DEFENSIVE-LOCK' in your 'tacticalDrift' field.
- Explain 'how the match goes' - focus on the tactical physics, not just a result prediction.
- If you find significant team news, reflect this in the 'tacticalShift' and 'adjustment' fields.`;

const generateAnalysisPrompt = (req: any, baselines: any, date: string) => `
    DATE: ${date}
    MATCH: ${req.homeTeam} vs ${req.awayTeam} (League: ${req.league || 'Unknown'})
    
    CRITICAL INSTRUCTIONS:
    1. SEARCH THE WEB FOR: Today's match-day news for ${req.homeTeam} and ${req.awayTeam}. Look for confirmed/projected lineups, key player injuries, and tactical previews from the last 12-24 hours.
    2. CROSS-REFERENCE: Compare your findings with these baselines: Home: ${JSON.stringify(baselines.home)}, Away: ${JSON.stringify(baselines.away)}.
    3. QUANTIFY DELTAS: In your 'adjustment' object, use 'aiScoringBaseline' to suggest a NEW xG baseline if today's news contradicts the historical stats.
    4. SUMMARY: Write a plain English description of how the match will play out based on YOUR REAL-TIME FINDINGS.
    5. REPORT: Return the JSON report including the 'sources' and specific player news.`;

    const getBaseline = (teamId: string): TeamMatchInput => {
    const b = getTeamBaseline(teamId);
    return {
        teamId,
        npxG: b.npxG,
        npxGA: b.avgXGA,
        sourceType: 'insufficient',
        sourceConfidence: b.purity,
        fetchedAt: new Date().toISOString()
    };
};

const generateFallbackAnalysis = async (
    req: any, 
    rhoData?: { rho: number, sigmaRho: number },
    marketOdds?: { over15: number; under15: number; over35: number; under35: number }
): Promise<AnalysisResult> => {
    const baselines = { 
        home: getBaseline(req.homeTeam), 
        away: getBaseline(req.awayTeam) 
    };

    const hP = IngestionService.standardize({ ...baselines.home, name: req.homeTeam }, { adjustmentA: 1, adjustmentB: 1 });
    const aP = IngestionService.standardize({ ...baselines.away, name: req.awayTeam }, { adjustmentA: 1, adjustmentB: 1 });
    
    const context: MatchContext = { 
        weather: "OVERCAST", 
        stakes: "STANDARD", 
        marketSentiment: "NEUTRAL", 
        tacticalDrift: "STABLE",
        date: new Date().toISOString().split('T')[0]
    };

    const rhoDataFinal = rhoData || { rho: -0.11, sigmaRho: 0.05 };

    const math = MatchEngine.calculateMatchExpectancy(hP, aP, context, marketOdds, rhoDataFinal);
    const verifiedPath = math.verifiedOptimalPath!;

    const summary = math.purity < 40 
        ? `Analysis for ${req.homeTeam} vs ${req.awayTeam} is running on structural league-average baselines as no real-time tactical signals could be verified. Expectancy is derived from global scoring distributions (${math.purity}% signal purity).`
        : math.summary;

    return {
        ...math,
        summary,
        surety: MatchEngine.calculateConfidenceAudit(math.probability / 100, verifiedPath.likelihood, math.purity)
    };
};

export const performAnalysis = async (req: any): Promise<AnalysisResult> => {
    const cacheKey = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase().replace(/\s/g, '');
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) return cachedEntry.result;

    const date = new Date().toISOString().split('T')[0];
    
    // THE DRIVESHAFT: Fetch real-time signals (Context, Odds, Weather) in parallel
    SystemLog(`Ingesting real-time signals for ${req.homeTeam} vs ${req.awayTeam}...`);
    const [leagueContext, liveOdds, liveWeather] = await Promise.all([
        IngestionService.getLeagueContext(req.league || 'EPL').catch(() => ({ rhoData: { rho: -0.11, sigmaRho: 0.05 } })),
        LiveOddsProvider.getOdds(req.league || 'EPL', `${req.homeTeam}-${req.awayTeam}`).catch(() => null),
        WeatherProvider.getForecast(51.5, -0.1, date).catch(() => null)
    ]);

    const marketOdds = liveOdds && liveOdds.over15 && liveOdds.under35
        ? { 
            over15: liveOdds.over15, 
            under15: liveOdds.under15 || 1 / (1 - 0.7), // Fallback
            over35: liveOdds.over35 || 1 / (1 - 0.15),  // Fallback
            under35: liveOdds.under35 
          }
        : undefined;

    const ai = getAI();
    let retryCount = 0;
    
    const attemptAnalysis = async (modelName: string): Promise<AnalysisResult | null> => {
        try {
            SystemLog(`Probing Tactical Layer: ${modelName}`);
            
            if (retryCount > 0) {
                const waitTime = Math.pow(4, retryCount) * 1000;
                SystemLog(`Backoff: waiting ${waitTime}ms...`);
                await sleep(waitTime);
            }

            const baselines = { 
                home: getBaseline(req.homeTeam), 
                away: getBaseline(req.awayTeam) 
            };
            
            // Call 1: Perform Grounded Research (No JSON Schema)
            SystemLog(`Performing Grounded Research: ${modelName}`);
            const searchResponse = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: generateAnalysisPrompt(req, baselines, date) }] }],
                config: { 
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: [{ googleSearch: {} }] as any
                }
            });

            const researchText = searchResponse.text;
            if (!researchText) return null;

            // Extract sources from the grounded call
            const grounding = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources = grounding.map((chunk: any) => chunk.web?.uri).filter(Boolean);

            // Call 2: Structure the research into the JSON schema (No Tools)
            SystemLog(`Structuring Analysis: ${modelName}`);
            const structureResponse = await ai.models.generateContent({
                model: modelName,
                contents: [{ 
                    role: "user", 
                    parts: [{ text: `Based on this research findings:\n\n${researchText}\n\nStructure it into the required JSON format for the match ${req.homeTeam} vs ${req.awayTeam}.` }] 
                }],
                config: { 
                    systemInstruction: SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json", 
                    responseSchema: analysisSchema as any
                }
            });

            if (!structureResponse.text) return null;
            const parsed = JSON.parse(structureResponse.text.trim());
            const normalize = (s: string | undefined, fallback: string) => (s && s.length > 2) ? s.trim().toUpperCase() : fallback;

            // COMBINE: Structural Ingested Data + Tactical AI Adjustments
            const hD = IngestionService.standardize({ 
                ...parsed.home, 
                npxGVariance: baselines.home.npxGVariance || 0.4,
                dataPurity: baselines.home.sourceConfidence || 0.5
            }, parsed.adjustment);

            const aD = IngestionService.standardize({ 
                ...parsed.away, 
                npxGVariance: baselines.away.npxGVariance || 0.4,
                dataPurity: baselines.away.sourceConfidence || 0.5
            }, parsed.adjustment);

            const context: MatchContext = {
                weather: liveWeather?.condition || normalize(parsed.context?.weather, "STANDARD"),
                stakes: normalize(parsed.context?.matchContextFlag, "STANDARD"),
                marketSentiment: normalize(parsed.context?.marketSentiment, "NEUTRAL"),
                tacticalDrift: normalize(parsed.context?.tacticalDrift, "STABLE"),
                date
            };

            // CONNECT: Pass real-time signals and fitted rhoData
            const rhoData = leagueContext.rhoData;

            const math = MatchEngine.calculateMatchExpectancy(hD, aD, context, marketOdds, rhoData);
            const verifiedPath = math.verifiedOptimalPath!;
            
            const finalResult: AnalysisResult = {
                ...math,
                summary: parsed.matchSummary || math.summary,
                surety: MatchEngine.calculateConfidenceAudit(math.probability / 100, verifiedPath.likelihood, math.purity),
                sources: sources.length > 0 ? sources : undefined,
                realTimeData: {
                    homeLineup: parsed.homeLineup,
                    awayLineup: parsed.awayLineup,
                    tacticalShift: parsed.tacticalShift
                }
            };

            cache.set(cacheKey, { result: finalResult, timestamp: Date.now() });
            return finalResult;
        } catch (e: any) {
            const isQuotaError = e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED");
            if (isQuotaError) {
                SystemLog(`CAPACITY_PEAK_REACHED`);
                throw e; 
            }
            SystemLog(`REQUEST_FAILED: ${e.message}`);
            return null;
        }
    };

    const models = [PRIMARY_MODEL, SECONDARY_MODEL, TERTIARY_MODEL];
    let result: AnalysisResult | null = null;

    for (const model of models) {
        try {
            result = await attemptAnalysis(model);
            if (result) break;
        } catch (e: any) {
            SystemLog("Transitioning to high-precision local analysis engine.");
            break;
        }
        retryCount++;
    }
    
    if (!result) {
        SystemLog("Activating strategic fallback engine (Nuclear Fortress).");
        return await generateFallbackAnalysis(req, leagueContext.rhoData, marketOdds);
    }
    
    return result;
};

