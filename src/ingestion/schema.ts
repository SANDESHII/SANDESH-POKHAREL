import { TeamStats, MatchContext } from '../types';

export interface TeamMatchInput {
    teamId: string;
    npxG: number;
    npxGA: number;
    sourceType: 'real_provider' | 'ai_estimate' | 'insufficient';
    sourceConfidence: number;   // 1.0 for verified provider, 0.6 for AI estimate, 0.0 for insufficient
    npxGVariance?: number;
    fetchedAt: string;
}

export interface RawMatchData {
    homeTeam: string;
    awayTeam: string;
    date: string;
    homeGoals?: number;
    awayGoals?: number;
    league: string;
    season: string;
}

export interface IngestedSignal {
    source: string;
    sourceType: 'real_provider' | 'ai_estimate' | 'insufficient';
    timestamp: number;
    fetchedAt: number;
    schemaVersion: string;
    purity: number;
    data: any;
}

export interface EnrichmentData {
    weather?: {
        temp: number;
        condition: string;
        precipitation: number;
    };
    odds?: {
        home: number;
        draw: number;
        away: number;
        over15?: number;
        under35?: number;
    };
    lineups?: {
        home: string[];
        away: string[];
    };
}

export interface StandardizedInput {
    home: TeamStats;
    away: TeamStats;
    homeInput: TeamMatchInput;
    awayInput: TeamMatchInput;
    context: MatchContext;
    enrichment: EnrichmentData;
    rhoData?: { rho: number; sigmaRho: number };
    provenance: {
        source: string;
        purity: number;
    };
}
