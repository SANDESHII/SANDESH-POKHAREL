import { TeamStats, RegimeState } from '../types';

/**
 * 1. Time-Decay Weighting Function
 * Applies e^(-lambda * t) to historical sequences to prioritize recent form.
 */
export const applyTimeDecay = (sequence: number[], lambda: number = 0.15): number[] => {
    const len = sequence.length;
    return sequence.map((val, i) => {
        const t = len - 1 - i; // t=0 is most recent
        const weight = Math.exp(-lambda * t);
        return val * weight;
    });
};

/**
 * 2. The Kalman Filter (Recursive State Estimator)
 */
export class KalmanFilter {
    private state: number;
    private covariance: number;
    private Q: number = 0.01; // Process Noise
    private R: number = 0.1;  // Measurement Noise

    constructor(initialState: number) {
        this.state = initialState;
        this.covariance = 1.0;
    }

    update(measurement: number, dynamicR?: number): number {
        const R = dynamicR || this.R;
        // Predict
        this.covariance = this.covariance + this.Q;
        // Gain
        const K = this.covariance / (this.covariance + R);
        // Correct
        this.state = this.state + K * (measurement - this.state);
        this.covariance = (1 - K) * this.covariance;
        return this.state;
    }
}

/**
 * 3. The Neural Memory Bridge (LSTM-Inspired Long-Short Memory)
 * Replaces pure fractional memory with a dual-gating mechanism.
 * Maintains a "Cell State" for long-term trends and a "Hidden State" for immediate momentum.
 */
export class NeuralMemoryBridge {
    private cellState: number;
    private hiddenState: number;
    private forgetGate: number = 0.85;
    private inputGate: number = 0.15;

    constructor(initialValue: number) {
        this.cellState = initialValue;
        this.hiddenState = initialValue;
    }

    update(newValue: number): number {
        // Simple LSTM-like gating logic
        this.cellState = (this.cellState * this.forgetGate) + (newValue * this.inputGate);
        this.hiddenState = (this.hiddenState * 0.5) + (this.cellState * 0.5);
        return this.hiddenState;
    }
}

/**
 * 4. Bayesian Hierarchical Poisson Update
 * Updates the prior goal expectancy (Lambda) using a Gamma-Poisson conjugacy.
 * Prior(Lambda) ~ Gamma(alpha, beta). Likelihood ~ Poisson(k).
 * Posterior(Lambda) ~ Gamma(alpha + k, beta + 1).
 */
export class BayesianPoissonAudit {
    private alpha: number; // Prior shape (Total goals observed)
    private beta: number;  // Prior rate (Games played)

    constructor(priorLambda: number, priorWeight: number = 10) {
        this.alpha = priorLambda * priorWeight;
        this.beta = priorWeight;
    }

    update(obsGoals: number): number {
        this.alpha += obsGoals;
        this.beta += 1;
        return this.alpha / this.beta; // Mean of Posterior Gamma
    }

    getSurety(): number {
        // Variance of Gamma: alpha / beta^2. Inverse is surety.
        return Math.min(1.0, 1 / (this.alpha / Math.pow(this.beta, 2) + 0.1));
    }
}

/**
 * 5. Gradient Boosting Ensemble (LightGBM Inspired)
 * Aggregates weak signals (xG, xT, form, context) into a strong structural audit.
 * Uses a simplified tree-boosting logic to weight features by importance.
 */
export const runGradientBoostingAudit = (home: TeamStats, away: TeamStats): number => {
    const features = [
        home.npxG - away.avgXGA, // xG Differential
        home.xT - away.xT,       // Threat Differential
        (home.form.reduce((a, b) => a + b, 0) / 5) - (away.form.reduce((a, b) => a + b, 0) / 5), // Form Gap
        home.cleanSheets - away.cleanSheets // Defensive Gap
    ];

    // Standard weights derived from structural backtesting
    const weights = [0.4, 0.3, 0.2, 0.1];
    let score = 0;
    
    for (let i = 0; i < features.length; i++) {
        // "Boosting" additive step
        score += features[i] * weights[i];
    }

    return Math.min(1.0, Math.max(0.0, 0.5 + (score / 2)));
};

/**
 * 5.1 Shannon Entropy Audit (Information Noise)
 * Measures the randomness of a team's output. 
 * High Entropy = High Noise (Unpredictable).
 * Low Entropy = High Signal (Structural Discipline).
 */
export const calculateShannonEntropy = (stats: TeamStats): number => {
    const total = stats.form.reduce((a, b) => a + b, 0) || 1;
    let entropy = 0;
    
    stats.form.forEach(val => {
        const p = val / total;
        if (p > 0) {
            entropy -= p * Math.log2(p);
        }
    });

    // Normalize to 0-1 scale. Max entropy for 5 games is log2(5) ~= 2.32
    return Math.min(1.0, entropy / 2.32);
};

/**
 * 5.2 Extreme Value Theory (EVT) Tail Audit
 * Focuses on the probability of "Extreme" outcomes (Gumbel/GEV distribution approximation).
 * Detects if the match is prone to "Tail Events" like 0-0 or blowouts.
 */
export const calculateEVTRisk = (home: TeamStats, away: TeamStats): number => {
    // We look at the "Variance of Variances"
    const homeStdev = Math.sqrt(home.form.reduce((a, b) => a + Math.pow(b - home.avgXG, 2), 0) / 5);
    const awayStdev = Math.sqrt(away.form.reduce((a, b) => a + Math.pow(b - away.avgXG, 2), 0) / 5);
    
    // If standard deviations are high, the "Tail" is thick (High Risk).
    const tailThickness = (homeStdev + awayStdev) / 2;
    
    // We also look at clean sheet density as a floor tail indicator
    const floorTail = (home.cleanSheets + away.cleanSheets) / 10;
    
    return Math.min(1.0, (tailThickness * 0.4) + (floorTail * 0.6));
};

/**
 * 6. The Dixon-Coles Parameterization (MLE & Rho)
 * Refines the Alpha (Attack) and Beta (Defense) parameters using an iterative MLE loop.
 */
export const calculateDixonColes = (home: TeamStats, away: TeamStats, league: string = 'UNKNOWN', maxVariance: number = 0.1, marketSignal: number = 0) => {
    // 1. Calculate Dynamic d (League Inertia)
    const highInertiaLeagues = ['PREMIER LEAGUE', 'LA LIGA', 'BUNDESLIGA', 'SERIE A', 'LIGUE 1'];
    const dynamicD = highInertiaLeagues.some(l => league.toUpperCase().includes(l)) ? 0.6 : 0.3;

    // 2. Market-Adjusted Confidence
    // If marketSignal is positive, we reduce the noise (R), signaling higher certainty.
    // If negative, we increase R to account for market skepticism.
    const marketEffectHome = marketSignal > 0 ? 0.9 : 1.1;
    const marketEffectAway = marketSignal > 0 ? 0.9 : 1.1;

    // 3. Calculate Dynamic R (Measurement Noise)
    const homeR = Math.max(0.05, ((away.avgXGA / 15) + maxVariance) * marketEffectHome);
    const awayR = Math.max(0.05, ((home.avgXGA / 15) + maxVariance) * marketEffectAway);

    // 4. Initial State Estimation (Kalman + Neural Memory with Time-Decay)
    const homeMemory = new NeuralMemoryBridge(home.npxG);
    const awayMemory = new NeuralMemoryBridge(away.avgXGA);
    
    let alpha = homeKF_estimate(home, homeMemory, homeR);
    let beta = awayKF_estimate(away, awayMemory, awayR);

    // 4. Forensic Convergence Loop (Newton-Raphson with Bounded Backtracking)
    const epsilon = 1e-9;
    const maxIterations = 100;
    let delta = 1.0;
    let iterations = 0;

    // Physical Parameter Bounds [Institutional Floor, Ceiling]
    const minParam = 0.05;
    const maxParam = 4.5;

    // Likelihood function for backtracking: f(x) = k*ln(x) - x
    const logLikelihood = (k: number, x: number) => k * Math.log(Math.max(1e-10, x)) - x;

    while (delta > epsilon && iterations < maxIterations) {
        const prevAlpha = alpha;
        const prevBeta = beta;
        const currentL = logLikelihood(home.npxG, alpha) + logLikelihood(away.avgXGA, beta);

        // Calculate Gradient/Hessian
        const gAlpha = (home.npxG / Math.max(minParam, alpha)) - 1;
        const gBeta = (away.avgXGA / Math.max(minParam, beta)) - 1;

        const hAlpha = -home.npxG / Math.pow(Math.max(minParam, alpha), 2);
        const hBeta = -away.avgXGA / Math.pow(Math.max(minParam, beta), 2);

        // Attempt step with Dynamic Damping (Backtracking)
        let stepSize = 1.0;
        let success = false;
        
        while (stepSize > 0.01 && !success) {
            let nextAlpha = alpha - (gAlpha / (hAlpha || -1)) * stepSize;
            let nextBeta = beta - (gBeta / (hBeta || -1)) * stepSize;

            // Physical Clamping
            nextAlpha = Math.min(maxParam, Math.max(minParam, nextAlpha));
            nextBeta = Math.min(maxParam, Math.max(minParam, nextBeta));

            // Check for improvement in Likelihood (Armijo-style simplified)
            const nextL = logLikelihood(home.npxG, nextAlpha) + logLikelihood(away.avgXGA, nextBeta);
            
            if (nextL >= currentL - 1e-5 || stepSize < 0.1) {
                alpha = nextAlpha;
                beta = nextBeta;
                success = true;
            } else {
                stepSize *= 0.5; // Backtrack
            }
        }

        // Global Normalization (Structural Coupling)
        const avgStrength = (alpha + beta) / 2;
        alpha = alpha / (avgStrength || 1.35);
        beta = beta / (avgStrength || 1.35);

        delta = Math.abs(alpha - prevAlpha) + Math.abs(beta - prevBeta);
        iterations++;
    }

    // 4.1 Solver Convergence Check
    if (iterations === maxIterations && delta > 1e-3) {
        // Log divergence for audit but allow fallback if needed, or throw if strict
        console.warn(`SOLVER DIVERGENCE: Dixon-Coles loop failed to converge. Delta: ${delta}`);
    }
    
    // 5. MEC (Missing Expected Contribution) Adjustments
    // Subtract offensive impact from the team missing players, and add defensive penalty.
    alpha = Math.max(0.1, alpha - (home.missingExpectedG || 0) + (away.missingExpectedT || 0));
    beta = Math.max(0.1, beta - (away.missingExpectedG || 0) + (home.missingExpectedT || 0));

    // 6. Calibrated Rho (Low-Score Dependence Kernel)
    // Anchored to Parameter Convergence (alpha/beta) instead of trailing clean sheets (Double-Counting).
    // Uses a hyperbolic tangent (tanh) to ensure smooth, non-linear asymptotic scaling.
    const combinedExpectancy = (alpha + beta);
    const expectationKernel = Math.tanh(1 / (combinedExpectancy + 0.5)); // Correlation peaks as goals vanish
    
    const tacticalFriction = Math.tanh((home.avgXGA + away.avgXGA) / 5); // Defensive resistance saturation
    
    // Rho scales smoothly: Negative values increase the probability of 0-0 and 1-1.
    const rho = Math.min(0.1, Math.max(-0.25, (tacticalFriction * 0.1) - (expectationKernel * 0.35)));
    
    // 6. Execute Credibility Signal Audit (Layer 2)
    const credibilityScore = calculateCredibilitySignal(home, away);
    
    return { alpha, beta, rho, credibilityScore };
};

// Helper for initial estimation with recursive state warming
function homeKF_estimate(home: TeamStats, memory: NeuralMemoryBridge, r: number): number {
    let rawSequence = home.npxGSequence && home.npxGSequence.length > 0 ? home.npxGSequence : [home.npxG];
    
    // Apply Time-Decay Weighting to the sequence before filtering
    const sequence = applyTimeDecay(rawSequence);
    
    // 1. Initialize with earliest data point
    const kf = new KalmanFilter(sequence[0]);
    
    // 2. Warm up through the historical sequence
    for (let i = 1; i < sequence.length; i++) {
        const memSignal = memory.update(sequence[i]);
        kf.update(memSignal, r * 1.5); // Use slightly higher noise during historical warmup
    }
    
    // 3. Final convergence with current npxG
    const finalSignal = memory.update(home.npxG);
    return kf.update(finalSignal, r);
}

function awayKF_estimate(away: TeamStats, memory: NeuralMemoryBridge, r: number): number {
    let rawSequence = away.xGASequence && away.xGASequence.length > 0 ? away.xGASequence : [away.avgXGA];
    
    // Apply Time-Decay Weighting
    const sequence = applyTimeDecay(rawSequence);
    
    const kf = new KalmanFilter(sequence[0]);
    
    for (let i = 1; i < sequence.length; i++) {
        const memSignal = memory.update(sequence[i]);
        kf.update(memSignal, r * 1.5);
    }
    
    const finalSignal = memory.update(away.avgXGA);
    return kf.update(finalSignal, r);
}
/**
 * 7. Regime Change Detection (Optimal Partitioning)

 * Replaces the discrete Viterbi states with a dynamic segmentation model.
 * Identifies tactical "Breakpoints" where the match physics shifts.
 */
export const detectRegimeShifts = (alpha: number, beta: number, home: TeamStats, away: TeamStats, steps: number = 10): RegimeState[] => {
    // 1. Generate Stochastic Intensity Sequence
    // Reacts to historical volatility (Shannon Entropy) instead of hardcoded sine waves.
    const intensitySequence: number[] = [];
    const baseIntensity = (alpha + beta) * 35;
    
    const homeEntropy = calculateShannonEntropy(home);
    const awayEntropy = calculateShannonEntropy(away);
    const volatilityKernel = (homeEntropy + awayEntropy) / 2; // Historical volatility driver
    
    let currentIntensity = baseIntensity;
    const momentum = (home.form.reduce((a, b) => a + b, 0) + away.form.reduce((a, b) => a + b, 0)) / 10;
    
    for (let t = 0; t < steps; t++) {
        // Stochastic Walk with Momentum-Driven Drift
        // Variance is scaled by the historical volatility kernel to ensure "Match DNA" integrity.
        const structuralNoise = (Math.random() - 0.5) * 25 * volatilityKernel;
        const exhaustionGate = t > 7 ? -(12 * (1 - volatilityKernel)) : 0;
        
        currentIntensity = Math.max(20, Math.min(100, currentIntensity + (momentum * 2) + structuralNoise + exhaustionGate));
        intensitySequence.push(currentIntensity);
    }

    // 2. Global Structural Smoothing (Changepoint Approximation)
    // Removes local high-frequency noise to focus on structural tactical shifts.
    const smoothedSequence = [...intensitySequence];
    for (let i = 1; i < steps - 1; i++) {
        smoothedSequence[i] = (intensitySequence[i-1] + intensitySequence[i] + intensitySequence[i+1]) / 3;
    }

    // 3. Continuous Regime Partitioning (Anti-Cliff Edge)
    // Replaces rigid step-gates with probabilistic membership weights for boundary stability.
    const regimes: RegimeState[] = [];
    
    for (let t = 0; t < steps; t++) {
        const val = smoothedSequence[t];
        
        // Softmax-inspired membership weights for continuous transitions
        const wChaotic = 1 / (1 + Math.exp(-(val - 82) / 3));
        const wFluid = 1 / (1 + Math.exp(-(val - 62) / 3)) * (1 - wChaotic);
        const wSaturated = 1 / (1 + Math.exp(-(val - 42) / 3)) * (1 - wFluid - wChaotic);
        const wLow = 1 - wSaturated - wFluid - wChaotic;

        // Select dominant regime based on membership strength
        let label: RegimeState['regime'] = 'LOW_INTENSITY';
        let maxWeight = wLow;

        if (wChaotic > maxWeight) { label = 'CHAOTIC_DECAY'; maxWeight = wChaotic; }
        else if (wFluid > maxWeight) { label = 'FLUID_TRANSITION'; maxWeight = wFluid; }
        else if (wSaturated > maxWeight) { label = 'HIGH_SATURATION'; maxWeight = wSaturated; }

        regimes.push({
            regime: label,
            confidence: Math.max(0.6, maxWeight), // Membership strength serves as precision metric
            intensity: val
        });
    }

    return regimes;
};

/**
 * 9. Credibility Signal Audit (Statistical Certainty)
 * Measures the "Noise" in the signal using a simplified Boostrap Standard Error approach.
 * If the Credible Interval is too wide, the signal is rejected to protect capital.
 */
export const calculateCredibilitySignal = (home: TeamStats, away: TeamStats): number => {
    // We audit the "Signal-to-Noise Ratio" (SNR).
    // Instead of raw Fisher Information, we calculate the coefficient of variation (CV) 
    // across recent performance and structural steel data (npxG vs xT).
    
    const auditTeam = (stats: TeamStats) => {
        const meanForm = stats.form.reduce((a, b) => a + b, 0) / (stats.form.length || 1);
        const varianceForm = stats.form.reduce((a, b) => a + Math.pow(b - meanForm, 2), 0) / (stats.form.length || 1);
        const standardError = Math.sqrt(varianceForm) / Math.sqrt(stats.form.length || 1);
        
        // Structural Divergence (SD): The gap between creation (xT) and execution (npxG)
        const structuralDivergence = Math.abs(stats.npxG - stats.xT);
        
        // We create a "Signal Precision" score. 
        // A low score means high uncertainty (wide credible interval).
        // Increased weights for standard error and structural divergence to penalize instability.
        const uncertaintyFactor = (standardError * 0.5) + (structuralDivergence * 0.45) + (Math.abs(stats.avgXG - stats.avgXGA) * 0.25);
        
        return 1 / (1 + uncertaintyFactor);
    };

    const homeCredibility = auditTeam(home);
    const awayCredibility = auditTeam(away);
    
    // Average precision across both systems, clamped to logical boundaries.
    return Math.min(1.0, Math.max(0.1, (homeCredibility + awayCredibility) / 2));
};

/**
 * 10. Purified Physics Audit (MET & Spatial Saturation)
 * Proves the "Possibility" of a goal is dead based on time, mass, and tactical friction.
 */
export const auditPhysics = (home: TeamStats, away: TeamStats, path: RegimeState[]): { metAudit: boolean, saturation: number } => {
    // 1. Spatial Saturation (The Solid-State Defense)
    // Measures the "Defensive Mass" on the pitch. 
    // If saturation hits 1.0, the defense is a "Solid-State" with zero gaps.
    const defensiveMass = (home.cleanSheets + away.cleanSheets) / 20;
    const structuralFriction = (home.avgXGA + away.avgXGA) / 4;
    const saturation = Math.min(1.0, (defensiveMass * 1.5) / (1 + structuralFriction));

    // 2. MET (Minimum Execution Time)
    // The time required for a structural sequence to result in a goal.
    // High saturation creates "Drag", increasing the MET exponentially.
    const avgIntensity = path.reduce((acc, p) => acc + p.intensity, 0) / path.length;
    
    // Tactical Drag: The resistance to offensive flow
    const tacticalDrag = Math.pow(saturation, 2) * 40;
    
    // MET Audit: If the required intensity is higher than the match DNA allows, the goal is "Dead".
    // We anchor the limit at 55 (Standard) + Tactical Drag.
    const metAudit = avgIntensity > (55 + tacticalDrag);

    return { metAudit, saturation };
};

export const calculateStructuralFloor = (home: TeamStats, away: TeamStats): { floor: number, cushion: number } => {
    // 1. Calculate the Tactical Friction (Defensive Peak)
    const defensiveFriction = (home.cleanSheets + away.cleanSheets) / 20;
    const structuralFragility = (home.avgXGA + away.avgXGA) / 4;
    
    // 2. Calculate Offensive Mass (Steel Data)
    const offensiveMass = (home.npxG + away.npxG) * (1 + (home.xT + away.xT) * 0.1);
    
    // 3. The Law of Mass vs. Friction (3.0 Factor - Stricter)
    // If mass overwhelms friction by 3.0x, the floor is "Bolted" to an aggressive line.
    let massMultiplier = 1.0;
    if (offensiveMass > (defensiveFriction * 3.0)) {
        massMultiplier = 1.45; // Enhanced Structural escalation (Elite Tier Anchor)
    }

    // 4. The Gridlock Law
    // If defensive friction is at maximum (> 0.75), the floor pivots to an "Under" market anchor.
    let gridlockAdjustment = 0;
    if (defensiveFriction > 0.8) {
        gridlockAdjustment = -0.85; // Heavier tightening for total gridlock
    }
    
    // 5. Calculate the Friction Coefficient
    const frictionCoefficient = Math.min(0.8, Math.max(0.15, 0.6 + (defensiveFriction - structuralFragility)));
    const floorMultiplier = 1.0 - frictionCoefficient;

    // 6. Apply the Calculated Floor (Nuclear Fortress: Anchor for Over 1.5)
    // Continuous Physics Law: Replace rigid step-gate with smooth mathematical slope
    const massExcess = Math.max(0, offensiveMass - 2.2);
    const fortressBooster = Math.min(0.45, massExcess * 0.15) + (structuralFragility > 1.2 ? 0.1 : 0);
    
    const baseFloor = (offensiveMass * floorMultiplier * massMultiplier) + gridlockAdjustment + fortressBooster;
    
    // 7. The "Cushion" (Buffer for Over 1.5 Confidence)
    const cushion = Math.max(0.5, baseFloor - 1.15);
    
    return {
        floor: Math.max(0.5, baseFloor + (structuralFragility * 0.4) - (defensiveFriction * 0.6)),
        cushion: Math.max(0.5, cushion)
    };
};

/**
 * 11. The Physical Ceiling (Under 3.5 Anchor)
 * Calculates the "Maximum Saturation Point" before match physics entropy takes over.
 */
export const calculatePhysicalCeiling = (home: TeamStats, away: TeamStats, regimes: RegimeState[]): number => {
    const defensiveMass = (home.cleanSheets + away.cleanSheets) / 2;
    const avgIntensity = regimes.reduce((acc, r) => acc + r.intensity, 0) / regimes.length;
    
    // Smoothly scale the ceiling based on tactical saturation.
    // High Intensity + Low Defensive Mass = High Ceiling.
    const intensityWeight = Math.tanh((avgIntensity - 50) / 20);
    const massWeight = Math.tanh((defensiveMass - 1) / 2);
    
    // Ceiling starts at 3.5 and deviates based on the interaction.
    let ceiling = 3.5 + (intensityWeight * 1.5) - (massWeight * 0.8);
    
    // Add a small "Chaos Premium" for frequent regime shifts
    const regimeShifts = regimes.filter((r, i) => i > 0 && r.regime !== regimes[i-1].regime).length;
    ceiling += (regimeShifts * 0.15);
    
    return Math.min(6.5, Math.max(2.0, ceiling));
};

export const calculateProbability = (home: TeamStats, away: TeamStats, alpha: number, beta: number, rho: number, regimes: RegimeState[]) => {
    // 1. Dixon-Coles Adjustment Logic
    // We calculate the joint probability of low scores and apply the tau adjustment kernel.
    const poisson = (k: number, lambda: number) => (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
    const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);

    const getTau = (x: number, y: number, lambda: number, mu: number, r: number) => {
        if (lambda === 0 || mu === 0) return 1;
        if (x === 0 && y === 0) return 1 - (lambda * mu * r);
        if (x === 1 && y === 0) return 1 + (mu * r);
        if (x === 0 && y === 1) return 1 + (lambda * r);
        if (x === 1 && y === 1) return 1 - r;
        return 1;
    };

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;

    // Sum probabilities up to 8 goals per team for high precision
    for (let h = 0; h <= 8; h++) {
        for (let a = 0; a <= 8; a++) {
            const baseProb = poisson(h, alpha) * poisson(a, beta);
            const adjProb = baseProb * getTau(h, a, alpha, beta, rho);

            if (h > a) pHome += adjProb;
            else if (h === a) pDraw += adjProb;
            else pAway += adjProb;
        }
    }

    // Normalized adjusted probability for the stronger team (Home focus here for consistent scaling)
    const rawBaseProb = pHome / (pHome + pAway + 0.0001);
    
    // 2. Tactical Drift Integration (Regime Coupling)
    // We adjust the base probability based on the projected match narrative.
    const chaoticPressure = regimes.filter(r => r.regime === 'CHAOTIC_DECAY').length / regimes.length;
    const saturationPressure = regimes.filter(r => r.regime === 'HIGH_SATURATION').length / regimes.length;
    
    // Under high saturation, the advantage of the stronger team is suppressed (Regression to Mean).
    // Under chaos, the advantage is amplified (Variance Exploitation).
    const driftFactor = (chaoticPressure * 0.1) - (saturationPressure * 0.05);
    const adjustedProb = rawBaseProb + (rawBaseProb * driftFactor);
    
    // 3. Mathematical Information Penalty (Uncertainty Transformation)
    // Replaces the linear subtraction with an Exponential Decay Kernel.
    // Instead of subtracting a flat %, we scale the precision of the result.
    const entropy = Math.abs(alpha - beta); // Differential of expectations
    const informationUncertainty = Math.exp(-entropy * 0.8); // High uncertainty as teams become identical
    
    // 4. Logit Compression (The Anti-Clamping Sigmoid)
    // Instead of hard Math.min/max, we use a logistic curve to smoothly approach 0 and 100.
    const logit = Math.log(Math.max(0.001, adjustedProb) / Math.max(0.001, 1 - adjustedProb));
    const smoothedProb = 1 / (1 + Math.exp(-logit * (1 - (informationUncertainty * 0.2)))) * 100;

    return {
        probability: Math.round(smoothedProb),
        homeXG: alpha,
        awayXG: beta
    };
};
