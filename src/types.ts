
export interface TeamStats {
    name: string;
    goalsScored: number;
    goalsConceded: number;
    avgXG: number;
    avgXGA: number;
    npxG: number; 
    xT: number;   
    form: number[];
    cleanSheets: number;
    // New metrics for variance and context
    npxG_Understat?: number;
    npxG_SofaScore?: number;
    redCardAnomalyMinutes?: number;
    managerSacked?: boolean;
    injuryCount?: number;
    missingExpectedG?: number;
    missingExpectedT?: number;
    missingPlayersList?: string[];
    npxGSequence?: number[];
    xGASequence?: number[];
}

export interface RegimeState {
    regime: 'LOW_INTENSITY' | 'FLUID_TRANSITION' | 'HIGH_SATURATION' | 'CHAOTIC_DECAY';
    confidence: number;
    intensity: number;
}

export interface MatchContext {
    weather: string;
    referee: string;
    stadium: string;
    historicalRivalry: number;
    stakes: string;
    confidenceVector: number; // 0 to 1: High value = stable environment, Low value = chaotic/high variance
}

export interface MarketReality {
    syndicateFlow: "HIGH" | "MEDIUM" | "LOW";
    smartMoneyTarget: string;
    marketDivergence: number;
    sentimentScore: number;
    openingOdds: { home: number, draw: number, away: number };
    currentOdds: { home: number, draw: number, away: number };
    marketMovementSignal: number; // -1 to 1: Positive means market agrees with model bias
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
    rho: number;
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
    modelAudit: ModelAudit;
    // System Status
    killSwitchTriggered: boolean;
    maxVariance: number;
    modelMode: 'NUCLEAR_FORTRESS' | 'POISSON_FALLBACK';
    matchContextFlag?: 'Dead-Rubber' | 'Derby' | 'Standard';
    calibration?: CalibrationMatrix;
}

export interface CalibrationMatrix {
    understatBias: number;
    sofaScoreBias: number;
    calibrationConfidence: number;
}

export interface ModelAudit {
    bayesianPoisson: number;
    gradientBoosting: number;
    neuralMemory: number;
    entropy: number;
    evtRisk: number;
}
