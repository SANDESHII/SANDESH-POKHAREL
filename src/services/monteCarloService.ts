
import { RegimeState } from '../types';

export interface StructuralAudit {
    totalGoalsFloor: string;
}

export interface InfallibleAudit {
    physicalCeiling: number;
    limitVerdict: string;
    range: string;
}

export interface MarketAudit {
    name: string;
    rawProb: number;
    regimeAlignment: number;
    suretyScore: number;
}

export interface SimulationResult {
    probability: number;
    hardZeroPoint: number;
    structuralAudit: StructuralAudit;
    infallibleAudit: InfallibleAudit;
    marketAudits: MarketAudit[];
    divergence: number;
    survivalRating: number; 
}

export const runMonteCarloSimulation = (
    initialProb: number, 
    path: RegimeState[],
    structuralFloor: number,
    physicalCeiling: number, // Added Physical Ceiling derived from mathUtils
    homeName: string,
    awayName: string,
    confidenceVector: number = 0.85, // Default high confidence
    rho: number = 0 // Dixon-Coles adjustment
): SimulationResult => {
    let homeOver05 = 0;
    let homeOver15 = 0;
    let awayOver05 = 0;
    let awayOver15 = 0;
    let totalOver05 = 0;
    let totalOver15 = 0;
    let totalOver25 = 0;
    let totalOver35 = 0; 
    let totalGoalsSum = 0;
    let totalWeight = 0;
    
    const iterations = 15000; 

    // Dixon-Coles Tau Adjustment Kernel
    const getTau = (x: number, y: number, lambda: number, mu: number, r: number) => {
        if (lambda === 0 || mu === 0) return 1;
        if (x === 0 && y === 0) return 1 - (lambda * mu * r);
        if (x === 1 && y === 0) return 1 + (mu * r);
        if (x === 1 && y === 1) return 1 - r;
        if (x === 0 && y === 1) return 1 + (lambda * r);
        return 1;
    };
    
    const noiseMultiplier = Math.max(0.5, 1.5 - confidenceVector);
    
    let totalProbSum = 0;
    let squaredProbSum = 0;
    
    for (let i = 0; i < iterations; i++) {
        const randomFactor = (Math.random() * 0.12 - 0.06) * noiseMultiplier;
        const pathInfluence = path.reduce((acc, p) => acc + (p.confidence * p.intensity), 0) / (path.length * 100);
        const currentProb = (initialProb / 100 + randomFactor + pathInfluence);
        
        totalProbSum += currentProb;
        squaredProbSum += currentProb * currentProb;

        // Goal Simulation for Market Audit (Anchored to Fortress Floor)
        const homeLambda = (structuralFloor / 2) * (currentProb * 2);
        const awayLambda = (structuralFloor / 2) * ((1 - currentProb) * 2);
        
        const simHomeGoals = poissonRandom(homeLambda);
        const simAwayGoals = poissonRandom(awayLambda);
        const totalGoals = simHomeGoals + simAwayGoals;
        const weight = getTau(simHomeGoals, simAwayGoals, homeLambda, awayLambda, rho);

        totalWeight += weight;
        totalGoalsSum += totalGoals * weight;

        if (simHomeGoals > 0) homeOver05 += weight;
        if (simHomeGoals > 1) homeOver15 += weight;
        if (simAwayGoals > 0) awayOver05 += weight;
        if (simAwayGoals > 1) awayOver15 += weight;
        if (totalGoals > 0) totalOver05 += weight;
        if (totalGoals > 1) totalOver15 += weight;
        if (totalGoals > 2) totalOver25 += weight;
        if (totalGoals > 3) totalOver35 += weight;
    }
    
    const meanProb = totalProbSum / iterations;
    const variance = (squaredProbSum / iterations) - (meanProb * meanProb);
    const sd = Math.sqrt(Math.max(0, variance));
    const divergence = sd * 100; // Scaled for the Nuclear Fortress UI feedback loop

    // 2. STRESS TEST (Inversion Audit / Disaster Scenarios)
    let survivalCount = 0;
    const stressIterations = 2500; 
    for (let j = 0; j < stressIterations; j++) {
        const disasterDrain = 0.55 - (Math.random() * 0.1); // Brutal drain for Fortress stress
        const stressProb = (initialProb / 100) * disasterDrain;
        
        const sHomeLambda = (structuralFloor / 2) * (stressProb * 2);
        const sAwayLambda = (structuralFloor / 2) * ((1 - stressProb) * 2);
        
        const sHomeGoals = poissonRandom(sHomeLambda);
        const sAwayGoals = poissonRandom(sAwayLambda);
        const sTotal = sHomeGoals + sAwayGoals;
        
        // Fortress Survival: Match stays within the 1-4 goal corridor
        if (sTotal >= 1 && sTotal <= 4) survivalCount++;
    }
    const survivalRating = (survivalCount / stressIterations) * 100;

    // 3. Market Audits (Weight-Adjusted Probabilities)
    const marketAudits: MarketAudit[] = [
        { name: "TOTAL OVER 1.5", rawProb: (totalOver15 / totalWeight) * 100, regimeAlignment: 0, suretyScore: 0 },
        { name: "TOTAL OVER 2.5", rawProb: (totalOver25 / totalWeight) * 100, regimeAlignment: 0, suretyScore: 0 },
        { name: "TOTAL UNDER 3.5", rawProb: (1 - (totalOver35 / totalWeight)) * 100, regimeAlignment: 0, suretyScore: 0 },
        { name: `${homeName} OVER 0.5`, rawProb: (homeOver05 / totalWeight) * 100, regimeAlignment: 0, suretyScore: 0 },
        { name: `${awayName} OVER 0.5`, rawProb: (awayOver05 / totalWeight) * 100, regimeAlignment: 0, suretyScore: 0 },
    ];

    const structuralAudit: StructuralAudit = {
        totalGoalsFloor: structuralFloor > 1.8 ? "SECURE OVER 1.5" : (structuralFloor > 1.2 ? "OVER 1.5" : "OVER 0.5")
    };

    const infallibleAudit: InfallibleAudit = {
        physicalCeiling,
        limitVerdict: `CEILING: ${physicalCeiling.toFixed(1)} GOALS`,
        range: `${structuralFloor.toFixed(1)}-${physicalCeiling.toFixed(1)} GOALS`
    };

    const tailRisk = Math.min(95, (divergence * 2.5) + (100 - initialProb) * 0.2);

    return {
        probability: initialProb,
        hardZeroPoint: 0.5 + (divergence / 100) + (tailRisk / 500),
        structuralAudit,
        infallibleAudit,
        marketAudits,
        divergence,
        survivalRating
    };
};

// Helper for Poisson distribution simulation
function poissonRandom(lambda: number): number {
    let L = Math.exp(-lambda);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}
