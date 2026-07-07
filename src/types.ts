
export interface TeamStats {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgXG: number;
    avgXGA: number;
    npxG: number; 
    xT: number;   
    defensiveStability: number;
    offensiveVolatility: number;
    form: number[];
    cleanSheets: number;
    npxGSequence?: number[];
    xGASequence?: number[];
    matchHistory?: any[];
    calibrationStability?: number;
    dataPurity?: number;
}

export interface TacticalPhase {
    state: 'CONSERVATIVE' | 'TRANSITIONAL' | 'DOMINANT' | 'HIGH_VARIANCE';
    confidence: number;
    intensity: number;
}

export interface TacticalSequence {
    label?: string;
    phases: TacticalPhase[];
    likelihood: number;
    accuracyScore?: number;
}

export interface ModelAudit {
    signalPurity: number;
    analysisStability: number;
    noiseRatio: number;
}

export interface AnalysisConfidence {
    confidenceScore: number;
    verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID';
    analysisReasoning: string[];
}

export interface MatchContext {
    weather: string;
    stakes: string;
    marketSentiment?: string;
    tacticalDrift?: string;
}

export interface AnalysisResult {
    probability: number;
    summary: string;
    homeStats: TeamStats;
    awayStats: TeamStats;
    homeXG: number;
    awayXG: number;
    dependence: number;
    tacticalPath: TacticalPhase[];
    verifiedOptimalPath?: TacticalSequence;
    minimumExpectancy: number;
    potentialCeiling: number;
    prediction?: string;
    predictionType?: 'OVER_15' | 'UNDER_35' | 'VOID';
    lockCount: number;
    isSureshot?: boolean;
    context: MatchContext;
    marketIndicators: {
        volume: string;
        sentimentScore: number;
    };
    modelAudit: ModelAudit;
    surety?: AnalysisConfidence;
    sources?: string[];
    realTimeData?: {
        homeLineup?: string[];
        awayLineup?: string[];
        tacticalShift?: string;
        injuries?: string[];
    };
}
