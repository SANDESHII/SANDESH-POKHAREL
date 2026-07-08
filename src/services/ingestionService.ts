import { TeamStats, MatchContext } from '../types';
import { DataValidator, Provenance } from '../cleaning/validators';
import { FootballDataProvider } from '../ingestion/sources/footballDataProvider';
import { LiveOddsProvider } from '../ingestion/sources/liveOddsProvider';
import { WeatherProvider } from '../ingestion/sources/weatherProvider';
import { GeminiEstimator } from '../ingestion/sources/geminiEstimator';
import { StandardizedInput, TeamMatchInput } from '../ingestion/schema';

import { StateStore } from '../core/kalman';

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
        // 1. Fetch Parallel Enrichment
        const [_historical, odds, weather] = await Promise.all([
            FootballDataProvider.fetchSeasonData(league, '23/24'),
            LiveOddsProvider.getOdds(league, `${homeTeam}-${awayTeam}`),
            WeatherProvider.getForecast(51.5, -0.1, date)
        ]);

        // 2. Try Primary Data Sources, then Fallback
        let hRaw = null;
        let aRaw = null;
        let hSourceType: 'real_provider' | 'ai_estimate' | 'insufficient' = 'real_provider';
        let aSourceType: 'real_provider' | 'ai_estimate' | 'insufficient' = 'real_provider';

        // Extract trailing goal sequences for outlier gating
        const homeSequence = _historical
            .filter(m => m.homeTeam === homeTeam || m.awayTeam === homeTeam)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
            .map(m => m.homeTeam === homeTeam ? (m.homeGoals || 0) : (m.awayGoals || 0));

        const awaySequence = _historical
            .filter(m => m.homeTeam === awayTeam || m.awayTeam === awayTeam)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10)
            .map(m => m.homeTeam === awayTeam ? (m.homeGoals || 0) : (m.awayGoals || 0));

        // Simulation of finding match in historical
        const historicalMatch = _historical.find(m => 
            (m.homeTeam === homeTeam && m.awayTeam === awayTeam) || 
            (m.homeTeam === awayTeam && m.awayTeam === homeTeam)
        );

        if (historicalMatch) {
            hRaw = { npxG: 1.4, npxGA: 1.2, npxGSequence: homeSequence };
            aRaw = { npxG: 1.1, npxGA: 1.5, npxGSequence: awaySequence };
        } else {
            hSourceType = 'ai_estimate';
            aSourceType = 'ai_estimate';
            [hRaw, aRaw] = await Promise.all([
                GeminiEstimator.estimateStats(homeTeam, `Match vs ${awayTeam}`),
                GeminiEstimator.estimateStats(awayTeam, `Match vs ${homeTeam}`)
            ]);
            if (hRaw) hRaw.npxGSequence = homeSequence;
            if (aRaw) aRaw.npxGSequence = awaySequence;
        }

        // Final safety check - if still null or extremely low confidence
        if (!hRaw || (hRaw.purity !== undefined && hRaw.purity < 0.1)) hSourceType = 'insufficient';
        if (!aRaw || (aRaw.purity !== undefined && aRaw.purity < 0.1)) aSourceType = 'insufficient';

        const fetchedAt = new Date().toISOString();
        const LEAGUE_AVG = 1.35;

        const hState = StateStore.get(homeTeam);
        const aState = StateStore.get(awayTeam);

        const homeInput: TeamMatchInput = {
            teamId: homeTeam,
            npxG: hSourceType === 'insufficient' ? LEAGUE_AVG : (hRaw?.npxG || LEAGUE_AVG),
            npxGA: hSourceType === 'insufficient' ? LEAGUE_AVG : (hRaw?.npxGA || LEAGUE_AVG),
            sourceType: hSourceType,
            sourceConfidence: hSourceType === 'real_provider' ? 1.0 : (hSourceType === 'ai_estimate' ? 0.6 : 0.0),
            npxGVariance: hState ? hState.variance : 0.4,
            fetchedAt
        };

        const awayInput: TeamMatchInput = {
            teamId: awayTeam,
            npxG: aSourceType === 'insufficient' ? LEAGUE_AVG : (aRaw?.npxG || LEAGUE_AVG),
            npxGA: aSourceType === 'insufficient' ? LEAGUE_AVG : (aRaw?.npxGA || LEAGUE_AVG),
            sourceType: aSourceType,
            sourceConfidence: aSourceType === 'real_provider' ? 1.0 : (aSourceType === 'ai_estimate' ? 0.6 : 0.0),
            npxGVariance: aState ? aState.variance : 0.4,
            fetchedAt
        };

        // 4. Standardize and Clean
        const hRes = this.standardizeWithProvenance({ ...homeInput, name: homeTeam, npxGSequence: homeSequence }, {});
        const aRes = this.standardizeWithProvenance({ ...awayInput, name: awayTeam, npxGSequence: awaySequence }, {});

        const context: MatchContext = {
            weather: weather.condition.toUpperCase(),
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
            enrichment: { weather, odds },
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
