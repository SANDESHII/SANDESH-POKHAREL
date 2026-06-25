
import { TeamStats, TacticalPhase, TacticalSequence, SimulationResult, AnalysisConfidence, MarketSimulation, BaselineReport, PotentialLimits, ModelAudit } from '../types';

// --- INGESTION LOGIC ---

export class IngestionService {
    static standardize(team: any, matrix: any): TeamStats {
        const adjustmentA = matrix?.adjustmentA || 0.88;
        const adjustmentB = matrix?.adjustmentB || 0.94;

        const parse = (v: any) => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string') return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
            return 0;
        };

        const npxG = parse(team.npxG);
        const xT = parse(team.xT);
        
        const weightedG = (npxG * adjustmentA + xT * (1 - adjustmentA));
        const finalNPXG = (weightedG + parse(team.avgXG)) / 2;

        const shift = Math.abs(finalNPXG - parse(team.avgXG));
        const calibrationStability = Math.max(0, 1 - (shift * 2));

        return {
            ...team,
            npxG: finalNPXG,
            xT: parse(team.xT),
            avgXG: parse(team.avgXG),
            avgXGA: parse(team.avgXGA),
            goalsScored: parse(team.goalsScored),
            goalsConceded: parse(team.goalsConceded),
            defensiveStability: parse(team.defensiveStability) || 0.5,
            offensiveVolatility: parse(team.offensiveVolatility) || 0.5,
            form: Array.isArray(team.form) ? team.form.map(parse) : [0.5],
            cleanSheets: parse(team.cleanSheets),
            calibrationStability,
            npxGSequence: Array.isArray(team.npxGSequence) ? team.npxGSequence.map(parse) : [],
            xGASequence: Array.isArray(team.xGASequence) ? team.xGASequence.map(parse) : [],
            matchHistory: Array.isArray(team.matchHistory) ? team.matchHistory : []
        };
    }
}

// --- SIGNAL FILTERING ---

class SignalFilter {
    private state: number;
    private uncertainty: number;

    constructor(initialState: number) {
        this.state = initialState;
        this.uncertainty = 0.5;
    }

    update(measurement: number, dataNoise: number, stateDrift: number, deltaT: number = 1.0): number {
        this.uncertainty = this.uncertainty + (stateDrift * deltaT);
        const weight = this.uncertainty / (this.uncertainty + dataNoise);
        this.state = this.state + weight * (measurement - this.state);
        this.uncertainty = (1 - weight) * this.uncertainty;
        return this.state;
    }
}

function calculateEntropy(form: number[]): number {
    const total = form.reduce((a, b) => a + b, 0) || 1;
    let entropy = 0;
    form.forEach(val => {
        const p = val / total;
        if (p > 0) entropy -= p * Math.log2(p);
    });
    return Math.min(1.0, entropy / 2.32);
}

function estimateState(team: TeamStats, noise: number): number {
    const history = team.matchHistory || [];
    let sequence: number[] = history.length > 0 ? history.map(m => m.xgScored) : (team.npxGSequence?.length ? team.npxGSequence : [team.npxG]);
    
    const entropy = calculateEntropy(team.form || [0.5]);
    const drift = 0.005 + (entropy * 0.08);
    const filter = new SignalFilter(sequence[0]);
    
    sequence.forEach(val => filter.update(val, noise, drift));
    return filter.update(team.npxG, noise, drift);
}

// --- CORE MODELS ---

export const calculateMatchExpectancy = (home: TeamStats, away: TeamStats, maxVariance: number, marketSignal: number) => {
    const marketEffect = marketSignal > 0 ? 0.9 : 1.1;
    const homeNoise = Math.max(0.05, (((1 - (home.defensiveStability || 0.5)) * 0.2) + ((home.offensiveVolatility || 0.5) * 0.1) + maxVariance) * marketEffect);
    const awayNoise = Math.max(0.05, (((1 - (away.defensiveStability || 0.5)) * 0.2) + ((away.offensiveVolatility || 0.5) * 0.1) + maxVariance) * marketEffect);

    const leagueAvg = 1.35;
    let homeParam = (estimateState(home, homeNoise) || 1.35) / leagueAvg;
    let awayParam = (estimateState(away, awayNoise) || 1.35) / leagueAvg;

    // Numerical optimization for param convergence
    for (let i = 0; i < 30; i++) {
        homeParam = (homeParam + (home.npxG / leagueAvg)) / 2;
        awayParam = (awayParam + (away.npxG / leagueAvg)) / 2;
    }

    const homeLambda = Math.max(0.1, Math.min(6.5, homeParam * leagueAvg));
    const awayMu = Math.max(0.1, Math.min(6.5, awayParam * leagueAvg));

    const dependence = Math.min(0.1, Math.max(-0.25, (Math.tanh((home.avgXGA + away.avgXGA) / 5) * 0.1) - (Math.tanh(1 / (homeLambda + awayMu + 0.5)) * 0.35)));
    
    return { homeScoring: homeLambda, awayScoring: awayMu, dependence, credibilityScore: calculateCredibility(home, away) };
};

export const calculateProbability = (hScoring: number, aScoring: number, dependence: number, phases: TacticalPhase[]) => {
    const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);
    const poisson = (k: number, lambda: number) => (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);

    const getAdj = (x: number, y: number, hL: number, aL: number, d: number) => {
        if (x === 0 && y === 0) return 1 - (hL * aL * d);
        if (x === 1 && y === 0) return 1 + (aL * d);
        if (x === 0 && y === 1) return 1 + (hL * d);
        if (x === 1 && y === 1) return 1 - d;
        return 1;
    };

    let pW = 0, pD = 0, pL = 0, total = 0;
    for (let h = 0; h <= 8; h++) {
        for (let a = 0; a <= 8; a++) {
            const p = poisson(h, hScoring) * poisson(a, aScoring) * getAdj(h, a, hScoring, aScoring, dependence);
            if (h > a) pW += p; else if (h === a) pD += p; else pL += p;
            total += p;
        }
    }

    const prob = Math.max(pW, pD, pL) / total;
    const chaos = phases.filter(p => p.state === 'HIGH_VARIANCE').length / phases.length;
    const finalProb = prob + (prob * (chaos * 0.1));

    return { probability: Math.round(finalProb * 100), homeXG: hScoring, awayXG: aScoring };
};

export const findTopTacticalPaths = (homeScoring: number, awayScoring: number): TacticalSequence[] => {
    const baseIntensity = (homeScoring + awayScoring) * 35;
    const phases = Array.from({ length: 10 }, (_, i) => {
        const drift = Math.sin(i * 0.5) * 10;
        const val = Math.max(20, Math.min(100, baseIntensity + drift));
        let state: TacticalPhase['state'] = 'CONSERVATIVE';
        if (val > 80) state = 'HIGH_VARIANCE';
        else if (val > 60) state = 'TRANSITIONAL';
        else if (val > 40) state = 'DOMINANT';
        
        return { state, intensity: val, confidence: 0.8 };
    });

    return [{ phases, likelihood: 0.9 }];
};

// --- AUDITS & METRICS ---

export const calculateCredibility = (home: TeamStats, away: TeamStats): number => {
    const audit = (s: TeamStats) => {
        const uncertainty = Math.abs(s.npxG - s.xT) * 0.4 + Math.abs(s.avgXG - s.avgXGA) * 0.2;
        return 1 / (1 + uncertainty);
    };
    return Math.min(1.0, Math.max(0.1, (audit(home) + audit(away)) / 2));
};

// --- SURETY AUDIT ---

export const runMatchSimulation = async (
    initialProb: number, 
    path: TacticalPhase[],
    minExpectancy: number,
    maxPotential: number,
    homeName: string,
    awayName: string,
    homeScoring: number = 1.35, 
    awayScoring: number = 1.35,     
    accuracyWeight: number = 0.85, 
    scoringConnection: number = 0,
    homeVolatility: number = 0.5,
    awayVolatility: number = 0.5,
    homeStability: number = 0.5,
    awayStability: number = 0.5,
    topTacticalPaths: any[] = []
): Promise<SimulationResult> => {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let homeOver05 = 0;
    let homeOver15 = 0;
    let awayOver05 = 0;
    let awayOver15 = 0;
    let totalOver05 = 0;
    let totalOver15 = 0;
    let totalOver25 = 0;
    let totalOver35 = 0; 
    let patternMatches = 0; 
    let totalGoalsSum = 0;
    let totalWeight = 0;
    
    const scoreGap = Math.abs(homeScoring - awayScoring);
    const iterations = scoreGap > 1.75 ? 2000 : 17500;
    const stressIterations = scoreGap > 1.75 ? 500 : 2500;
    const batchSize = 2500;

    const getAdjustment = (x: number, y: number, hS: number, aS: number, connection: number) => {
        if (hS === 0 || aS === 0) return 1;
        if (x === 0 && y === 0) return 1 - (hS * aS * connection);
        if (x === 1 && y === 0) return 1 + (aS * connection);
        if (x === 1 && y === 1) return 1 - connection;
        if (x === 0 && y === 1) return 1 + (hS * connection);
        return 1;
    };
    
    const noiseFactor = Math.max(0.5, 1.5 - accuracyWeight);
    let totalProbSum = 0;
    let squaredProbSum = 0;
    
    for (let i = 0; i < iterations; i++) {
        if (i > 0 && i % batchSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const varianceSignal = (Math.random() * 0.12 - 0.06) * noiseFactor;
        const trendInfluence = path.reduce((acc, p) => acc + (p.confidence * p.intensity), 0) / (path.length * 100);
        const currentProb = (initialProb / 100 + varianceSignal + trendInfluence);
        
        totalProbSum += currentProb;
        squaredProbSum += currentProb * currentProb;

        const hShift = (Math.random() * 0.2 - 0.1) * (homeVolatility || 0.5);
        const aShift = (Math.random() * 0.2 - 0.1) * (awayVolatility || 0.5);

        const hL = (homeScoring * (1 + hShift)) * (0.8 + (1 - (awayStability || 0.5)) * 0.4) * (currentProb * 2);
        const aM = (awayScoring * (1 + aShift)) * (0.8 + (1 - (homeStability || 0.5)) * 0.4) * ((1 - currentProb) * 2);
        
        const combinedScoring = hL + aM;
        const normalizedH = (hL / (combinedScoring || 1)) * minExpectancy;
        const normalizedA = (aM / (combinedScoring || 1)) * minExpectancy;
        
        const simHomeGoalsRaw = predictGoals(normalizedH);
        const simAwayGoalsRaw = predictGoals(normalizedA);
        
        let simHomeGoals = simHomeGoalsRaw;
        let simAwayGoals = simAwayGoalsRaw;
        if (simHomeGoals + simAwayGoals > maxPotential) {
            const ratio = maxPotential / (simHomeGoals + simAwayGoals);
            simHomeGoals = Math.floor(simHomeGoals * ratio);
            simAwayGoals = Math.floor(simAwayGoals * ratio);
        }

        const totalGoals = simHomeGoals + simAwayGoals;
        const weight = getAdjustment(simHomeGoals, simAwayGoals, normalizedH, normalizedA, scoringConnection);

        totalWeight += weight;
        totalGoalsSum += totalGoals * weight;

        if (simHomeGoals > simAwayGoals) homeWins += weight;
        else if (simHomeGoals === simAwayGoals) draws += weight;
        else awayWins += weight;

        if (simHomeGoals > 0) homeOver05 += weight;
        if (simHomeGoals > 1) homeOver15 += weight;
        if (simAwayGoals > 0) awayOver05 += weight;
        if (simAwayGoals > 1) awayOver15 += weight;
        if (totalGoals > 0) totalOver05 += weight;
        if (totalGoals > 1) totalOver15 += weight;
        if (totalGoals > 2) totalOver25 += weight;
        if (totalGoals > 3) totalOver35 += weight;
        if (totalGoals === 2 || totalGoals === 3) patternMatches += weight;
    }
    
    const avgProb = totalProbSum / iterations;
    const outcomeVariance = (squaredProbSum / iterations) - (avgProb * avgProb);
    const rangeVal = Math.sqrt(Math.max(0, outcomeVariance));
    const outcomeRange = rangeVal * 100;

    let stableCount = 0;
    for (let j = 0; j < stressIterations; j++) {
        if (j > 0 && j % batchSize === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const stressReduction = 0.55 - (Math.random() * 0.1); 
        const stressProb = (initialProb / 100) * stressReduction;
        
        const totalPower = homeScoring + awayScoring;
        const sHomeScoring = (homeScoring / (totalPower || 1)) * minExpectancy * (stressProb * 2);
        const sAwayScoring = (awayScoring / (totalPower || 1)) * minExpectancy * ((1 - stressProb) * 2);
        
        const sHomeGoalsRaw = predictGoals(sHomeScoring);
        const sAwayGoalsRaw = predictGoals(sAwayScoring);
        
        let sHomeGoals = sHomeGoalsRaw;
        let sAwayGoals = sAwayGoalsRaw;
        if (sHomeGoals + sAwayGoals > maxPotential) {
            const ratio = maxPotential / (sHomeGoals + sAwayGoals);
            sHomeGoals = Math.floor(sHomeGoals * ratio);
            sAwayGoals = Math.floor(sAwayGoals * ratio);
        }

        const sTotal = sHomeGoals + sAwayGoals;
        if (sTotal >= 1 && sTotal <= 4) stableCount++;
    }
    const stabilityScore = (stableCount / stressIterations) * 100;

    const checkAlignment = (marketName: string) => {
        const isOver = marketName.includes('OVER') || marketName.includes('0.5');
        const isUnder = marketName.includes('UNDER');
        
        const alignmentValue = path.reduce((acc, p) => {
            let mult = 0;
            if (p.state === 'DOMINANT' || p.state === 'HIGH_VARIANCE') mult = isOver ? 1 : -0.8;
            if (p.state === 'CONSERVATIVE') mult = isUnder ? 1 : -0.8;
            if (p.state === 'TRANSITIONAL') mult = 0.2;
            return acc + (mult * (p.intensity / 100) * p.confidence);
        }, 0);
        
        return Math.min(100, Math.max(0, 70 + (alignmentValue * 20)));
    };

    const complexityFactor = topTacticalPaths.length + (path.length / 4);
    const accuracyDampener = Math.max(0.80, 1 - (complexityFactor * 0.02)); 

    const baseSurety = Math.min(100, Math.max(0, (accuracyWeight * 100) - (outcomeRange * 0.8))) * accuracyDampener;

    const marketAudits: MarketSimulation[] = [
        { name: `${homeName} WIN`, rawProb: (homeWins / totalWeight) * 100, phaseAlignment: checkAlignment(`${homeName} WIN`), suretyScore: baseSurety * 1.05 },
        { name: `${awayName} WIN`, rawProb: (awayWins / totalWeight) * 100, phaseAlignment: checkAlignment(`${awayName} WIN`), suretyScore: baseSurety * 1.05 },
        { name: "DRAW", rawProb: (draws / totalWeight) * 100, phaseAlignment: checkAlignment("DRAW"), suretyScore: baseSurety * 0.8 },
        { name: "TOTAL OVER 1.5", rawProb: (totalOver15 / totalWeight) * 100, phaseAlignment: checkAlignment("TOTAL OVER 1.5"), suretyScore: baseSurety },
        { name: "TOTAL OVER 2.5", rawProb: (totalOver25 / totalWeight) * 100, phaseAlignment: checkAlignment("TOTAL OVER 2.5"), suretyScore: baseSurety * 0.9 },
        { name: "TOTAL UNDER 3.5", rawProb: (1 - (totalOver35 / totalWeight)) * 100, phaseAlignment: checkAlignment("TOTAL UNDER 3.5"), suretyScore: baseSurety * 0.95 },
        { name: "STABILITY PATTERN", rawProb: (patternMatches / totalWeight) * 100, phaseAlignment: checkAlignment("TOTAL OVER 1.5") * 0.5 + checkAlignment("TOTAL UNDER 3.5") * 0.5, suretyScore: baseSurety * 1.1 },
        { name: `${homeName} OVER 0.5`, rawProb: (homeOver05 / totalWeight) * 100, phaseAlignment: checkAlignment("HOME OVER 0.5"), suretyScore: baseSurety * 1.1 },
        { name: `${awayName} OVER 0.5`, rawProb: (awayOver05 / totalWeight) * 100, phaseAlignment: checkAlignment("AWAY OVER 0.5"), suretyScore: baseSurety * 1.1 },
    ].map(m => ({ ...m, suretyScore: Math.min(100, m.suretyScore) }));

    const baselineReport: BaselineReport = {
        expectancyNote: minExpectancy > 1.8 ? "OVER 1.5 (STABLE)" : (minExpectancy > 1.2 ? "OVER 1.5" : "OVER 0.5")
    };

    const potentialLimits: PotentialLimits = {
        maximumPotential: maxPotential,
        potentialVerdict: `POTENTIAL: ${maxPotential?.toFixed(1) || '0.0'} GOALS`,
        range: `${minExpectancy?.toFixed(1) || '0.0'}-${maxPotential?.toFixed(1) || '0.0'} GOALS`
    };

    const riskSignal = Math.min(95, (outcomeRange * 2.5) + (100 - initialProb) * 0.2);

    return {
        probability: initialProb,
        baselineRisk: 0.5 + (outcomeRange / 100) + (riskSignal / 500),
        baselineReport,
        potentialLimits,
        marketAudits,
        outcomeRange,
        stabilityScore,
        computeOptimized: scoreGap > 1.75
    };
};

function predictGoals(lambda: number): number {
    let L = Math.exp(-lambda);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}

export const calculateConfidenceAudit = (
    simulation: SimulationResult,
    modelAudit: ModelAudit
): AnalysisConfidence => {
    const score = (simulation.probability * 0.3) + (simulation.stabilityScore * 0.4) + (modelAudit.signalPurity * 20);
    const verdict = score > 75 ? 'GOLD' : (score > 55 ? 'SILVER' : 'BRONZE');
    
    return {
        confidenceScore: Math.min(100, score),
        verdict,
        isHighConfidence: verdict === 'GOLD',
        analysisReasoning: ["Pattern convergence optimal.", "Scoring baseline stable."],
        bestBet: simulation.marketAudits.reduce((prev, curr) => (curr.rawProb * curr.suretyScore > prev.rawProb * prev.suretyScore) ? curr : prev),
        stabilityScore: simulation.stabilityScore
    };
};
