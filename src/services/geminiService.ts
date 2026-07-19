import { GoogleGenAI, Type } from "@google/genai";
import { MatchEngine } from "./engine";
import { IngestionService } from "./ingestionService";
import { StatsCleaner } from "../cleaning/statsCleaner";
import { getTeamBaseline, computeBaselineFromHistory } from "./baselineDataService";
import { IngestionValidator } from "../ingestion/validator";
import { AnalysisResult, MatchContext } from "../types";
import { TeamMatchInput } from "../ingestion/schema";
import { LiveOddsProvider } from "../ingestion/sources/liveOddsProvider";
import { WeatherProvider } from "../ingestion/sources/weatherProvider";
import { TeamMappingService } from "./teamMappingService";
import { VenueService } from "./venueService";
import { RapidApiFootballProvider } from "../ingestion/sources/rapidApiFootballProvider";

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

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        verifiedFacts: {
            type: Type.OBJECT,
            properties: {
                homeLineup: { type: Type.ARRAY, items: { type: Type.STRING } },
                awayLineup: { type: Type.ARRAY, items: { type: Type.STRING } },
                injuries: { 
                    type: Type.OBJECT,
                    properties: {
                        home: { type: Type.ARRAY, items: { type: Type.STRING } },
                        away: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["home", "away"]
                },
                weather: { type: Type.STRING },
                matchContext: { type: Type.STRING, enum: ["Dead-Rubber", "Derby", "Standard"] },
                tacticalDrift: { type: Type.STRING, description: "Qualitative observation of how teams are shifting (e.g. HIGH-LINE, LOW-BLOCK)" },
                verifiedNewsSummary: { type: Type.STRING, description: "Facts found in the last 12-24 hours regarding rotation or motivation" }
            },
            required: ["homeLineup", "awayLineup", "injuries", "weather", "matchContext", "tacticalDrift", "verifiedNewsSummary"]
        },
        reasonedAdjustments: {
            type: Type.OBJECT,
            properties: {
                homeOffenseDelta: { type: Type.NUMBER, description: "Adjustment to home npxG based ON FACTS ONLY (e.g. -0.15 for missing winger)" },
                homeDefenseDelta: { type: Type.NUMBER, description: "Adjustment to home npxGA (e.g. +0.10 if first-choice keeper is out)" },
                awayOffenseDelta: { type: Type.NUMBER },
                awayDefenseDelta: { type: Type.NUMBER },
                logic: { type: Type.STRING, description: "Quant-shop reasoning: step-by-step linking of FACTS to numerical DELTAS." }
            },
            required: ["homeOffenseDelta", "homeDefenseDelta", "awayOffenseDelta", "awayDefenseDelta", "logic"]
        },
        matchSummary: { type: Type.STRING, description: "A technical summary of the tactical physics of the game." },
        predictionType: { type: Type.STRING, enum: ["OVER_15", "UNDER_35"] },
        tacticalEdge: {
            type: Type.OBJECT,
            properties: {
                referee: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        cardRate: { type: Type.STRING, description: "e.g. 4.2 Yellows / Game" },
                        penaltyRate: { type: Type.STRING, description: "e.g. 0.25 Pens / Game" },
                        tendency: { type: Type.STRING, enum: ["STRICT", "LENIENT", "AVERAGE"] }
                    },
                    required: ["name", "cardRate", "penaltyRate", "tendency"]
                },
                pressing: {
                    type: Type.OBJECT,
                    properties: {
                        homePPDA: { type: Type.STRING, description: "Passes Per Defensive Action" },
                        awayPPDA: { type: Type.STRING },
                        homeLineHeight: { type: Type.STRING, description: "e.g. 52.4m" },
                        awayLineHeight: { type: Type.STRING }
                    },
                    required: ["homePPDA", "awayPPDA", "homeLineHeight", "awayLineHeight"]
                }
            },
            required: ["referee", "pressing"]
        }
    },
    required: ["verifiedFacts", "reasonedAdjustments", "matchSummary", "predictionType", "tacticalEdge"]
};

const SystemLog = (msg: string) => console.log(`[QUANT_REASONER] ${msg}`);

const SYSTEM_INSTRUCTION = `You are a REASONING LAYER for a high-frequency football quant shop.
- CORE MISSION: Adjust GROUND TRUTH baselines based ONLY on REAL-TIME NEWS found via search.
- DETERMINISM: You are strictly FORBIDDEN from generating or estimating historical team statistics (goals, xG, clean sheets). Use the provided baselines as the absolute truth.
- SEARCH SCOPE: Your search is strictly limited to the targets defined in the prompt (Lineups, Injuries, Weather, Match Context, Referee, Pressing Stats).
- TACTICAL EDGE: Use FBref and related signals to identify 'PPDA' and 'Defensive Line Height'. Use Referee Assignment to identify 'Card Rates'.
- CATEGORY A (FACTS): Report ONLY search findings into 'verifiedFacts'.
- CATEGORY B (REASONING): Calculate 'reasonedAdjustments' (deltas). 
- INTEGRITY: If search returns no meaningful news regarding a team, its deltas MUST be 0.0.`;

const generateAnalysisPrompt = (req: any, baselines: any, date: string) => {
    const venue = VenueService.getVenue(req.homeTeam);
    return `
    DATE: ${date}
    MATCH: ${req.homeTeamName} vs ${req.awayTeamName} (League: ${req.league || 'Unknown'})
    STADIUM: ${venue.name} (Location: ${venue.lat}, ${venue.lon})
    
    HISTORICAL BASELINES (DO NOT MODIFY):
    Home: ${JSON.stringify(baselines.home)}
    Away: ${JSON.stringify(baselines.away)}
    
    SEARCH TARGETS (SEARCH ONLY FOR THESE):
    1. Confirmed/Projected Lineups for both ${req.homeTeamName} and ${req.awayTeamName}.
    2. Injury/Suspension reports (who is definitely OUT for today).
    3. Local Weather conditions at the stadium (${venue.name}).
    4. Referee Assignment: Search for the assigned referee and their historical card/penalty rates.
    5. Tactical Pressing Stats: Search for both teams' PPDA (Passes Per Defensive Action) and average defensive line height from FBref.
    6. Match Context (e.g. Is it a Derby? Is it a Dead-Rubber?).
    7. Verified News (Last 12-24h regarding squad rotation or motivation).

    OBJECTIVE:
    1. PERFORM GOOGLE SEARCH for the specific targets listed above.
    2. REASON: Based ONLY on the facts found in search, calculate numerical DELTAS (adjustments) to the historical npxG/npxGA baselines.
    3. SCHEMA: Return the JSON. If no news is found for a field, use 'STANDARD' or empty arrays and 0.0 deltas.`;
};

const getBaseline = (teamId: string): TeamMatchInput => {
    const b = getTeamBaseline(teamId);
    return {
        teamId,
        npxG: b.npxG,
        npxGA: b.avgXGA,
        sourceType: b.purity > 0.5 ? 'real_provider' : 'ai_estimate',
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

    const hP = IngestionService.standardize({ ...baselines.home, name: req.homeTeamName }, { adjustmentA: 1, adjustmentB: 1 });
    const aP = IngestionService.standardize({ ...baselines.away, name: req.awayTeamName }, { adjustmentA: 1, adjustmentB: 1 });
    
    const context: MatchContext = { 
        weather: "OVERCAST", 
        stakes: "STANDARD", 
        marketSentiment: "NEUTRAL", 
        tacticalDrift: "STABLE",
        date: new Date().toISOString().split('T')[0]
    };

    const rhoDataFinal = rhoData || { rho: -0.11, sigmaRho: 0.05 };

    const math = MatchEngine.calculateMatchExpectancy(hP, aP, context, marketOdds, rhoDataFinal);

    const summary = math.purity < 40 
        ? `Analysis for ${req.homeTeamName} vs ${req.awayTeamName} is running on structural league-average baselines as no real-time tactical signals could be verified. Expectancy is derived from global scoring distributions (${math.purity}% signal purity).`
        : math.summary;

    return {
        ...math,
        summary,
        dataSource: 'FALLBACK_STATIC',
        provenance: 'HEURISTIC_FALLBACK',
        surety: MatchEngine.calculateConfidenceAudit(math.probability / 100, math.purity),
        tacticalEdge: {
            referee: { name: 'PENDING', cardRate: '0.0', penaltyRate: '0.0', tendency: 'AVERAGE' },
            pressing: { homePPDA: 'N/A', awayPPDA: 'N/A', homeLineHeight: 'N/A', awayLineHeight: 'N/A' }
        }
    };
};

export const performAnalysis = async (rawReq: any): Promise<AnalysisResult> => {
    const hMap = TeamMappingService.canonicalize(rawReq.homeTeam);
    const aMap = TeamMappingService.canonicalize(rawReq.awayTeam);
    
    const req = {
        ...rawReq,
        homeTeam: hMap.id,
        awayTeam: aMap.id,
        homeTeamName: TeamMappingService.getDisplayName(hMap.id),
        awayTeamName: TeamMappingService.getDisplayName(aMap.id),
        isHomeMapped: hMap.isMapped,
        isAwayMapped: aMap.isMapped
    };

    const cacheKey = `${req.homeTeam}-${req.awayTeam}-${req.league}`.toLowerCase().replace(/\s/g, '');
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) return cachedEntry.result;

    const date = new Date().toISOString().split('T')[0];
    
    SystemLog(`Ingesting real-time signals for ${req.homeTeamName} vs ${req.awayTeamName}...`);
    const venue = VenueService.getVenue(req.homeTeam);
    const season = "2023"; // Reference season
    const league = req.league || 'EPL';

    const [leagueContext, liveOdds, liveWeather, rapidFixtureId, allInjuries] = await Promise.all([
        IngestionService.getLeagueContext(league).catch(() => ({ rhoData: { rho: -0.11, sigmaRho: 0.05 } })),
        LiveOddsProvider.getOdds(league, `${req.homeTeamName}-${req.awayTeamName}`).catch(() => null),
        WeatherProvider.getForecast(venue.lat, venue.lon, date).catch(() => null),
        RapidApiFootballProvider.findFixtureId(req.homeTeamName, req.awayTeamName, league, season).catch(() => null),
        RapidApiFootballProvider.fetchInjuries(league, season).catch(() => [])
    ]);

    // Fetch fixture details for referee info
    const fixtureDetails = rapidFixtureId ? await RapidApiFootballProvider.fetchFixtures(league, season).then(fs => fs.find(f => f.fixture.id === rapidFixtureId)).catch(() => null) : null;
    const referee = fixtureDetails?.fixture.referee || 'UNKNOWN';

    // Fetch lineups if we have a fixture ID
    const lineups = rapidFixtureId ? await RapidApiFootballProvider.fetchLineups(rapidFixtureId).catch(() => null) : null;
    
    // Filter injuries for relevant teams
    const relevantInjuries = allInjuries.filter((i: any) => 
        i.team.name.toLowerCase().includes(req.homeTeamName.toLowerCase()) || 
        i.team.name.toLowerCase().includes(req.awayTeamName.toLowerCase())
    );

    const groundTruthData = {
        referee,
        injuries: relevantInjuries.map((i: any) => ({ player: i.player.name, team: i.team.name, reason: i.player.reason, type: i.player.type })),
        lineups: lineups ? lineups.map((l: any) => ({ team: l.team.name, formation: l.formation, startXI: l.startXI?.map((p: any) => p.player.name) })) : 'NOT_YET_AVAILABLE',
        weather: liveWeather
    };

    const marketOdds = liveOdds && liveOdds.over15 && liveOdds.under35
        ? { 
            over15: liveOdds.over15, 
            under15: liveOdds.under15 || 1 / (1 - 0.7), 
            over35: liveOdds.over35 || 1 / (1 - 0.15),
            under35: liveOdds.under35 
          }
        : undefined;

    const baselinesOutside = {
        home: getBaseline(req.homeTeam),
        away: getBaseline(req.awayTeam)
    };

    const promptBase = generateAnalysisPrompt(req, baselinesOutside, date);
    const groundTruthPromptPart = `\n\nGROUND TRUTH DATA (VERIFIED PROVIDER):\n${JSON.stringify(groundTruthData, null, 2)}`;
    
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

            const leagueMatches = (leagueContext as any).matches || [];

            const baselines = { 
                home: {
                    teamId: req.homeTeam,
                    ...computeBaselineFromHistory(req.homeTeam, leagueMatches),
                    sourceType: 'real_provider' as const,
                    fetchedAt: new Date().toISOString()
                }, 
                away: {
                    teamId: req.awayTeam,
                    ...computeBaselineFromHistory(req.awayTeam, leagueMatches),
                    sourceType: 'real_provider' as const,
                    fetchedAt: new Date().toISOString()
                } 
            };

            const fullPrompt = generateAnalysisPrompt(req, baselines, date) + groundTruthPromptPart;
            
            // Map purity to sourceConfidence
            (baselines.home as any).sourceConfidence = (baselines.home as any).purity;
            (baselines.away as any).sourceConfidence = (baselines.away as any).purity;
            
            SystemLog(`Performing Grounded Research: ${modelName}`);
            const searchResponse = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    tools: [{ googleSearch: {} }] as any
                }
            });

            const researchText = searchResponse.text;
            if (!researchText) return null;

            const grounding = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources = grounding.map((chunk: any) => chunk.web?.uri).filter(Boolean);

            SystemLog(`Structuring Analysis: ${modelName}`);
            const structureResponse = await ai.models.generateContent({
                model: modelName,
                contents: [{ 
                    role: "user", 
                    parts: [{ text: `Based on this research findings:\n\n${researchText}\n\nStructure it into the required JSON format for the match ${req.homeTeamName} vs ${req.awayTeamName}. Focus on REAL facts found.` }] 
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

            // REASONING LAYER LOGIC: Blend Baselines with AI-derived deltas
            const facts = parsed.verifiedFacts;
            const adjustments = IngestionValidator.validateReasonedAdjustments(parsed.reasonedAdjustments, baselines);
            
            const hStats: TeamMatchInput = {
                teamId: req.homeTeam,
                npxG: Math.max(0.2, baselines.home.npxG + (adjustments.homeOffenseDelta ?? 0)),
                npxGA: Math.max(0.2, baselines.home.avgXGA + (adjustments.homeDefenseDelta ?? 0)),
                sourceType: 'real_provider',
                sourceConfidence: baselines.home.purity,
                fetchedAt: new Date().toISOString()
            };

            const aStats: TeamMatchInput = {
                teamId: req.awayTeam,
                npxG: Math.max(0.2, baselines.away.npxG + (adjustments.awayOffenseDelta ?? 0)),
                npxGA: Math.max(0.2, baselines.away.avgXGA + (adjustments.awayDefenseDelta ?? 0)),
                sourceType: 'real_provider',
                sourceConfidence: baselines.away.purity,
                fetchedAt: new Date().toISOString()
            };

            const hD = StatsCleaner.cleanTeamStats({ 
                ...hStats, 
                name: req.homeTeam,
                goalsScored: baselines.home.goalsScored ?? 0,
                goalsConceded: baselines.home.goalsConceded ?? 0,
                form: baselines.home.form || [0.5],
                matchHistory: baselines.home.matchHistory || [],
                cleanSheets: baselines.home.cleanSheets,
                avgXG: baselines.home.avgXG,
                avgXGA: baselines.home.avgXGA,
                npxGSequence: baselines.home.npxGSequence,
                avgXGSequence: baselines.home.avgXGSequence,
                xGASequence: baselines.home.xGASequence,
                defensiveStabilitySequence: baselines.home.defensiveStabilitySequence,
                offensiveVolatilitySequence: baselines.home.offensiveVolatilitySequence
            }).stats;

            const aD = StatsCleaner.cleanTeamStats({ 
                ...aStats, 
                name: req.awayTeam,
                goalsScored: baselines.away.goalsScored ?? 0,
                goalsConceded: baselines.away.goalsConceded ?? 0,
                form: baselines.away.form || [0.5],
                matchHistory: baselines.away.matchHistory || [],
                cleanSheets: baselines.away.cleanSheets,
                avgXG: baselines.away.avgXG,
                avgXGA: baselines.away.avgXGA,
                npxGSequence: baselines.away.npxGSequence,
                avgXGSequence: baselines.away.avgXGSequence,
                xGASequence: baselines.away.xGASequence,
                defensiveStabilitySequence: baselines.away.defensiveStabilitySequence,
                offensiveVolatilitySequence: baselines.away.offensiveVolatilitySequence
            }).stats;

            const context: MatchContext = {
                weather: liveWeather?.condition || normalize(facts.weather, "STANDARD"),
                stakes: normalize(facts.matchContext, "STANDARD"),
                marketSentiment: "NEUTRAL",
                tacticalDrift: normalize(facts.tacticalDrift, "STABLE"),
                date
            };

            const rhoData = leagueContext.rhoData;

            const math = MatchEngine.calculateMatchExpectancy(hD, aD, context, marketOdds, rhoData);
            
            const finalResult: AnalysisResult = {
                ...math,
                summary: parsed.matchSummary || math.summary,
                verifiedFacts: facts,
                reasonedAdjustments: adjustments,
                dataSource: 'LIVE',
                provenance: 'AI_GROUNDED',
                surety: MatchEngine.calculateConfidenceAudit(math.probability / 100, math.purity),
                sources: sources.length > 0 ? sources : undefined,
                realTimeData: {
                    homeLineup: facts.homeLineup,
                    awayLineup: facts.awayLineup,
                    tacticalShift: adjustments.logic,
                    injuries: [
                        ...(facts.injuries?.home || []),
                        ...(facts.injuries?.away || [])
                    ]
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
            SystemLog(`Model ${model} failed (${e.message?.slice(0, 60)}). Trying next model in cascade.`);
            retryCount++;
            continue;
        }
        retryCount++;
    }
    
    if (!result) {
        SystemLog("Activating strategic fallback engine (Nuclear Fortress).");
        return await generateFallbackAnalysis(req, leagueContext.rhoData, marketOdds);
    }
    
    return result;
};
