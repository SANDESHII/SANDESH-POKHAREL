import { TeamStats, MatchContext } from '../types';
import { DataValidator, Provenance } from '../cleaning/validators';
import { FootballDataProvider } from '../ingestion/sources/footballDataProvider';
import { LiveOddsProvider } from '../ingestion/sources/liveOddsProvider';
import { WeatherProvider } from '../ingestion/sources/weatherProvider';
import { GeminiEstimator } from '../ingestion/sources/geminiEstimator';
import { StandardizedInput, TeamMatchInput } from '../ingestion/schema';

import { StateStore } from '../core/kalman';
import { PersistenceService } from './persistenceService';

/**
 * INGESTION SERVICE
 * Coordinates data entry and initial standardization across multiple providers.
 */
export class IngestionService {
    private static clean(v: any, fallback: number = 0): number {
        if (typeof v === 'number') return isNaN(v) ? fallback : v;
        if (typeof v === 'string') {
            const sanitized = v.replace(/%/g, '').replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(sanitized);
            if (isNaN(parsed)) return fallback;
            if (v.includes('%') && parsed > 1) return parsed / 100;
            return parsed;
        }
        return fallback;
    }

    /**
     * MAIN ENTRY POINT for full-stack ingestion
     * Implements priority: Real Providers -> AI Estimate -> Insufficient
     */
    static async ingestMatch(
        homeTeam: string, 
        awayTeam: string, 
        league: string, 
        date: string
    ): Promise<StandardizedInput> {
        // 1. Fetch Parallel Enrichment with explicit fallback tiers
        const [historicalData, odds, weather] = await Promise.all([
            FootballDataProvider.fetchSeasonData(league, '23/24'),
            LiveOddsProvider.getOdds(league, `${homeTeam}-${awayTeam}`),
            WeatherProvider.getForecast(51.5, -0.1, date)
        ]);

        // 2. Fallback Chain for Team Stats
        const getTeamStatsChain = async (teamId: string): Promise<{ stats: any, sourceType: 'real_provider' | 'ai_estimate' | 'insufficient' }> => {
            // Tier 1: Real historical matches for this specific team
            const teamMatches = historicalData.filter(m => m.homeTeam === teamId || m.awayTeam === teamId);
            
            if (teamMatches.length >= 3) {
                const goals = teamMatches.map(m => m.homeTeam === teamId ? (m.homeGoals || 0) : (m.awayGoals || 0));
                const ga = teamMatches.map(m => m.homeTeam === teamId ? (m.awayGoals || 0) : (m.homeGoals || 0));
                const avgG = goals.reduce((a, b) => a + b, 0) / goals.length;
                const avgGA = ga.reduce((a, b) => a + b, 0) / ga.length;

                return {
                    stats: { npxG: avgG, npxGA: avgGA, npxGSequence: goals.slice(0, 10) },
                    sourceType: 'real_provider'
                };
            }

            // Tier 2: Gemini Estimate (AI tier)
            const aiEstimate = await GeminiEstimator.estimateStats(teamId, `Recent form in ${league}`);
            if (aiEstimate && aiEstimate.purity > 0.1) {
                return {
                    stats: { ...aiEstimate, npxGSequence: [] },
                    sourceType: 'ai_estimate'
                };
            }

            // Tier 3: League Average (Insufficient)
            return {
                stats: { npxG: 1.35, npxGA: 1.35, npxGSequence: [] },
                sourceType: 'insufficient'
            };
        };

        const [hTier, aTier] = await Promise.all([
            getTeamStatsChain(homeTeam),
            getTeamStatsChain(awayTeam)
        ]);

        const hRaw = hTier.stats;
        const aRaw = aTier.stats;
        const hSourceType = hTier.sourceType;
        const aSourceType = aTier.sourceType;

        const fetchedAt = new Date().toISOString();
        const LEAGUE_AVG = 1.35;

        // Load latent states from persistence
        if (!StateStore.get(homeTeam)) {
            const hPersisted = await PersistenceService.getTeamState(homeTeam);
            if (hPersisted) StateStore.set(homeTeam, hPersisted);
        }
        if (!StateStore.get(awayTeam)) {
            const aPersisted = await PersistenceService.getTeamState(awayTeam);
            if (aPersisted) StateStore.set(awayTeam, aPersisted);
        }

        const hState = StateStore.get(homeTeam);
        const aState = StateStore.get(awayTeam);

        const homeInput: TeamMatchInput = {
            teamId: homeTeam,
            npxG: hRaw?.npxG || LEAGUE_AVG,
            npxGA: hRaw?.npxGA || LEAGUE_AVG,
            sourceType: hSourceType,
            sourceConfidence: hSourceType === 'real_provider' ? 1.0 : (hSourceType === 'ai_estimate' ? 0.6 : 0.0),
            npxGVariance: hState ? hState.variance : 0.4,
            fetchedAt
        };

        const awayInput: TeamMatchInput = {
            teamId: awayTeam,
            npxG: aRaw?.npxG || LEAGUE_AVG,
            npxGA: aRaw?.npxGA || LEAGUE_AVG,
            sourceType: aSourceType,
            sourceConfidence: aSourceType === 'real_provider' ? 1.0 : (aSourceType === 'ai_estimate' ? 0.6 : 0.0),
            npxGVariance: aState ? aState.variance : 0.4,
            fetchedAt
        };

        // 4. Standardize and Clean
        const hRes = this.standardizeWithProvenance({ ...homeInput, name: homeTeam, npxGSequence: hRaw.npxGSequence }, {});
        const aRes = this.standardizeWithProvenance({ ...awayInput, name: awayTeam, npxGSequence: aRaw.npxGSequence }, {});

        const context: MatchContext = {
            weather: weather ? weather.condition.toUpperCase() : 'WEATHER_UNAVAILABLE',
            stakes: 'STANDARD',
            marketSentiment: 'NEUTRAL',
            tacticalDrift: 'STABLE',
            date
        };

        return {
            home: hRes.stats,
            away: aRes.stats,
            homeInput,
            awayInput,
            context,
            enrichment: { 
                weather: weather || { temp: 0, condition: 'UNAVAILABLE', precipitation: 0 }, 
                odds: odds || null // Explicitly null if unavailable
            },
            provenance: {
                source: hSourceType === 'real_provider' ? 'FootballDataCSV' : (hSourceType === 'ai_estimate' ? 'GeminiEstimator' : 'Insufficient'),
                purity: (homeInput.sourceConfidence + awayInput.sourceConfidence) / 2
            }
        };
    }

    static quantifySignal(signal: string, type: 'DRIFT' | 'SENTIMENT' | 'STAKES'): number {
        const s = (signal || '').toUpperCase();
        switch (type) {
            case 'DRIFT':
                if (s.includes('CRITICAL-ROTATION')) return 1.65;
                if (s.includes('ATTACKING-SHIFT')) return 1.45;
                return 1.0;
            case 'SENTIMENT':
                if (s.includes('BULLISH')) return 0.22;
                return 0;
            case 'STAKES':
                if (s.includes('KNOCKOUT')) return 1.25;
                if (s.includes('CRITICAL')) return 1.15;
                return 1.0;
            default:
                return 1.0;
        }
    }

    static standardize(team: Record<string, any>, matrix: Record<string, any>): TeamStats {
        return this.standardizeWithProvenance(team, matrix).stats;
    }

    static standardizeWithProvenance(team: Record<string, any>, matrix: Record<string, any>): { stats: TeamStats; provenance: Provenance } {
        const reliability = DataValidator.clamp(this.clean(matrix?.reliabilityScore, 0.5), 0, 1.0);
        const rawNPXG = DataValidator.clamp(this.clean(team.npxG), 0, 5.5);
        const baselineXG = DataValidator.clamp(this.clean(team.avgXG), 0, 5.0);
        
        const aiWeight = DataValidator.clamp(reliability * 0.95, 0.45, 0.95);
        const baselineWeight = 1 - aiWeight;
        
        const suggestedBaseline = DataValidator.clamp(this.clean(matrix?.aiScoringBaseline), 0.5, 4.5);
        const effectiveBaselineXG = suggestedBaseline > 0.5 ? (baselineXG * 0.3 + suggestedBaseline * 0.7) : baselineXG;

        const finalizedExpectancy = (rawNPXG * aiWeight) + (effectiveBaselineXG * baselineWeight);

        return DataValidator.cleanTeamStats({
            ...team,
            npxG: finalizedExpectancy,
            avgXG: effectiveBaselineXG,
            dataPurity: team.purity || 0.85
        });
    }
}
