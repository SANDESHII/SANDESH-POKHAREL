
export interface MatchHistoryItem {
    goalsScored: number;
    goalsConceded: number;
    xgScored: number;
    xgConceded: number;
    daysAgo: number;
    isHome: boolean;
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
    matchHistory?: MatchHistoryItem[];
    calibrationStability?: number;
}

export interface TacticalPhase {
    state: 'CONSERVATIVE' | 'TRANSITIONAL' | 'DOMINANT' | 'HIGH_VARIANCE';
    confidence: number;
    intensity: number;
}

export interface MatchContext {
    weather: string;
    referee: string;
    stadium: string;
    historicalRivalry: number;
    stakes: string;
}

export interface MarketIndicators {
    volume: "HIGH" | "MEDIUM" | "LOW";
    marketDivergence: number;
    sentimentScore: number;
    marketMovementSignal: number;
}

export interface DataConsistencyReport {
    contradictions: string[];
    riskScore: number;
}

export interface TacticalSequence {
    phases: TacticalPhase[];
    likelihood: number;
}

export interface AdjustmentMatrix {
    adjustmentA: number;
    adjustmentB: number;
    reliabilityScore: number;
}

export interface ModelAudit {
    signalPurity: number;
    analysisStability: number;
    noiseRatio: number;
}

export interface BaselineReport {
    expectancyNote: string;
}

export interface PotentialLimits {
    maximumPotential: number;
    potentialVerdict: string;
    range: string;
}

export interface MarketSimulation {
    name: string;
    rawProb: number;
    phaseAlignment: number;
    suretyScore: number;
}

export interface SimulationResult {
    probability: number;
    baselineRisk: number;
    baselineReport: BaselineReport;
    potentialLimits: PotentialLimits;
    marketAudits: MarketSimulation[];
    outcomeRange: number;
    stabilityScore: number; 
    computeOptimized: boolean; 
}

export interface AnalysisConfidence {
    confidenceScore: number;
    verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID';
    isHighConfidence: boolean;
    analysisReasoning: string[];
    bestBet: MarketSimulation | null;
    stabilityScore: number;
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
    topTacticalPaths?: TacticalSequence[];
    minimumExpectancy: number;
    potentialCeiling: number;
    prediction?: string;
    predictionType?: 'OVER' | 'UNDER' | 'BTTS' | 'WIN' | 'DRAW' | 'STABILITY';
    context: MatchContext;
    marketIndicators: MarketIndicators;
    dataConsistency: DataConsistencyReport;
    modelAudit: ModelAudit;
    adjustment?: AdjustmentMatrix;
}
