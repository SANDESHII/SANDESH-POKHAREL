
export interface TeamBaseline {
    npxG: number;
    xT: number;
    avgXG: number;
    avgXGA: number;
    cleanSheets: number;
    purity: number; // 1.0 = Real Data, 0.2 = Name-Hash Fallback
}

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
    npxGVariance?: number;
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
    signalStrength: number;
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
    date?: string;
    restDays?: {
        home: number;
        away: number;
    };
}

export interface MarketData {
    odds: {
        over15: number;
        under15: number; 
        under35: number;
        over35: number;
        homeWin: number;
        draw: number;
        awayWin: number;
    };
    impliedProb: {
        over15: number;
        under35: number;
    };
    edge: {
        over15: number;
        under35: number;
    };
    source: string;
    isSimulated?: boolean;
}

export interface StakingPlan {
    strategy: 'KELLY' | 'FRACTIONAL_KELLY' | 'FLAT';
    suggestedStake: number; // Percentage of bankroll
    expectedValue: number;
}

export interface SimulationResult {
    mean: number;
    median: number;
    stdDev: number;
    confidenceInterval: [number, number];
    distribution: number[]; // Histogram of goals
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
    predictionLabel?: string;
    lockCount: number;
    purity: number;
    signalStrength: number;
    isSureshot?: boolean;
    context: MatchContext;
    marketIndicators: {
        volume: string;
        sentimentScore: number;
    };
    marketData?: MarketData;
    staking?: StakingPlan;
    simulation?: SimulationResult;
    modelAudit: ModelAudit;
    surety?: AnalysisConfidence;
    sources?: string[];
    provenance?: 'AI_GROUNDED' | 'HEURISTIC_FALLBACK';
    realTimeData?: {
        homeLineup?: string[];
        awayLineup?: string[];
        tacticalShift?: string;
        injuries?: string[];
    };
    dataSource: 'LIVE' | 'FALLBACK_STATIC';
    debug?: {
        modelUsed?: string;
        attemptsCount: number;
        errors: string[];
    };
}
