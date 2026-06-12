
import { TeamStats, RegimeState, MatchContext, MarketReality, MirrorMatch, ProsecutionCase, ModelAudit } from '../types';
import { SimulationResult, MarketAudit } from './monteCarloService';
import { calculateEVTRisk } from './mathUtils';

export interface MedallionResult {
    suretyScore: number;
    evtTailRisk: number;
    signalPrecision: number;
    physicsAudit: { metAudit: boolean, saturation: number };
    contextualVolatility: number;
    verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID';
    auditNote: string;
    isMedallionSurety: boolean;
    isNuclearFortress: boolean;
    fortressReasoning: string[];
    cushionFloor: number;
    p10StructuralEstimate: {
        verdict: string;
        confidence: number;
        reasoning: string;
    };
    masteryCorridor: {
        anchor: 'OVER 1.5' | 'UNDER 3.5' | 'NEUTRAL';
        surety: number;
    };
    marketAudits: MarketAudit[];
    bestBet: MarketAudit | null;
    survivalRating: number;
    mirrorSimilarity: number;
    prosecutionRisk: number;
}

/**
 * Contextual Volatility Audit
 * Quantifies non-statistical friction (Rivalry, Stakes, Referee) into a Volatility Coefficient.
 * This is the "Soft Data" layer purified into a numerical tax.
 */
export const calculateContextualVolatility = (context: MatchContext): number => {
    let friction = 0.2;
    
    // Factor in rivalry (The "Derby" effect)
    friction += (context.historicalRivalry / 10) * 0.3;
    
    // Factor in stakes (The "Desperation" effect)
    const stakesLower = context.stakes.toLowerCase();
    if (stakesLower.includes('final') || stakesLower.includes('relegation') || stakesLower.includes('derby')) {
        friction += 0.2;
    }
    
    // Factor in referee (The "Strictness" effect)
    if (context.referee.toLowerCase().includes('strict') || context.referee.toLowerCase().includes('lahoz')) {
        friction += 0.1;
    }

    return Math.min(1.0, friction);
};

/**
 * Medallion Surety Calculation
 * The final forensic seal that cross-references all layers against Market Reality.
 */
export const calculateMedallionSurety = (
    simulation: SimulationResult,
    regimePath: RegimeState[],
    structuralData: { floor: number, cushion: number },
    evtRisk: number,
    signalPrecision: number,
    physics: { metAudit: boolean, saturation: number },
    market: MarketReality,
    context: MatchContext,
    mirrorMatches: MirrorMatch[],
    prosecution: ProsecutionCase,
    modelAudit: ModelAudit
): MedallionResult => {
    // 1. Adaptive Benchmarks (Derived from Signal Stability and Volatility)
    const contextualVolatility = calculateContextualVolatility(context);
    
    const adpFloorThreshold = 2.15 + (contextualVolatility * 0.35); 
    const adpSurvivalThreshold = 97 - (signalPrecision * 3); 
    const adpPrecisionThreshold = 0.90 + (contextualVolatility * 0.03);
    const adpProsecutionThreshold = 20 - (contextualVolatility * 14); 
    const adpSaturationThreshold = 0.60 - (contextualVolatility * 0.20); 

    // 2. Calculate Mirror Match Similarity (Ancestral Law)
    // We check if historical outcomes match the current "Floor Verdict".
    const successfulMirrors = mirrorMatches.filter(m => m.result.includes('Win') || m.result.includes('Over') || m.result.includes('Goals')).length;
    const mirrorSimilarity = (successfulMirrors / (mirrorMatches.length || 1)) * 100;

    // Neural Divergence Analysis (GOD TIER GATE)
    // We check for "Module Conflict". If modules disagree, Elite verdicts are revoked.
    const physicsMass = physics.metAudit ? 1 : 0;
    const statisticalMass = simulation.survivalRating > 85 ? 1 : 0;
    const marketMass = market.syndicateFlow === 'HIGH' ? 1 : 0;
    const mirrorMass = mirrorSimilarity > 80 ? 1 : 0;
    
    const neuralCoherence = (physicsMass + statisticalMass + marketMass + mirrorMass) / 4;

    // 3. Prosecution Risk (The Inversion Penalty)
    const prosecutionRisk = prosecution.riskScore;

    // 4. Calculate Convergence (How well do the layers agree?)
    const combinedIntensity = regimePath.reduce((acc, s) => acc + s.intensity, 0) / regimePath.length;
    const floorAgreement = Math.abs(structuralData.floor - (combinedIntensity / 40));
    
    // 5. Base Surety from Monte Carlo Divergence & Survival Rating
    // We factor in information noise (Entropy) and boosting confidence.
    const neuralMass = (modelAudit.gradientBoosting * 0.4) + (modelAudit.bayesianPoisson * 0.4) + ((1 - modelAudit.entropy) * 0.2);
    
    let suretyScore = (simulation.probability * 0.3) + (simulation.survivalRating * 0.3) + (mirrorSimilarity * 0.2) + (neuralMass * 20);
    let localAuditNote = "Standard audit complete.";

    // Apply Prosecution Tax (Inversion Audit)
    if (prosecutionRisk > 60) {
        suretyScore -= (prosecutionRisk * 0.25);
        localAuditNote = "INVERSION AUDIT: High prosecution risk detected. Structural contradictions found.";
    }

    // 3b. Tactical Pruning Audit (Layer 3)
    // We use the Regime Path to prune "Statistical Hallucinations".
    // If the path is "Locked" in a regime, we penalize divergence that contradicts that state.
    const pathRegimes = regimePath.map(p => p.regime);
    const isLockedLow = pathRegimes.every(r => r === 'LOW_INTENSITY' || r === 'HIGH_SATURATION');
    const isLockedHigh = pathRegimes.every(r => r === 'FLUID_TRANSITION' || r === 'CHAOTIC_DECAY');

    if (isLockedLow && simulation.divergence > 15) {
        // Pruning high-scoring hallucinations in a low-intensity lock
        suretyScore -= 20;
        localAuditNote = "TACTICAL PRUNING: High divergence detected in low-intensity regime. Pruning hallucinations.";
    }
    
    // 4. Signal Precision Audit (Layer 2)
    // Measures the "Noise" in the signal. If precision is low (wide credible interval), we apply a "Hard Ceiling".
    let precisionCeiling = 100;

    if (signalPrecision < 0.5) {
        precisionCeiling = 65; // Hard Ceiling for Noisy Data
        localAuditNote = "REJECTED: Signal precision too low (Uncertainty Gap). Data is structurally noisy.";
    } else if (signalPrecision < 0.7) {
        precisionCeiling = 80; // Soft Ceiling for Moderate Noise
    }
    
    suretyScore = Math.min(suretyScore, precisionCeiling);

    // 5. Purified Physics Audit (Layer 4)
    // If the match fails the MET Audit or hits Spatial Saturation, we "Throttle" the surety.
    if (!physics.metAudit) {
        suretyScore -= 25; // Increased penalty for physical impossibility
        localAuditNote = "PHYSICS AUDIT FAILED: Minimum Execution Time (MET) exceeds tactical capacity.";
    }
    
    // Spatial Saturation Throttle
    if (physics.saturation > adpSaturationThreshold) {
        suretyScore -= 15;
        localAuditNote = "PHYSICS AUDIT: Spatial Saturation exceeds adaptive threshold. Pitch is in a 'Solid-State'.";
    }

    // 6. Contextual Volatility Tax
    // High friction (Derbies, Finals) taxes the surety score heavily.
    if (contextualVolatility > 0.65) {
        suretyScore -= 20;
        if (contextualVolatility > 0.85 && signalPrecision < 0.75) {
            suretyScore -= 30; // Extreme Volatility Kill Switch
            localAuditNote = "VOLATILITY KILL SWITCH: Extreme contextual noise with unstable signal.";
        }
    }

    // 7. Market Reality Tally (SYNDICATE AUDIT)
    if (market.syndicateFlow === 'HIGH') {
        suretyScore += 10;
    } else if (market.syndicateFlow === 'LOW') {
        suretyScore -= 15;
    }

    // 6. Market Auditor Scoring
    // We rank every market based on Raw Prob, Regime Alignment, and Signal Precision.
    const scoredMarkets = simulation.marketAudits.map(audit => {
        let alignment = 0;
        const name = audit.name.toUpperCase();
        
        // Regime Alignment Logic
        const pathRegimes = regimePath.map(p => p.regime);
        const hasHighIntensity = pathRegimes.includes('FLUID_TRANSITION') || pathRegimes.includes('CHAOTIC_DECAY');
        const hasLowIntensity = pathRegimes.includes('LOW_INTENSITY') || pathRegimes.includes('HIGH_SATURATION');

        if (name.includes('OVER')) {
            alignment = hasHighIntensity ? 20 : (hasLowIntensity ? -30 : 0);
        }

        // Final Surety Score for this specific market
        // Regime Alignment acts as a "Tactical Pruning" multiplier
        const alignmentMultiplier = 1 + (alignment / 100);
        const marketSurety = ((audit.rawProb * 0.6) + (signalPrecision * 100) * 0.4) * alignmentMultiplier;
        
        return {
            ...audit,
            regimeAlignment: alignment,
            suretyScore: Math.min(100, Math.max(0, marketSurety))
        };
    });

    // Find the Best Bet (Highest Surety Score, biased towards Fortress Corridor)
    const bestBet = scoredMarkets.reduce((prev, current) => {
        const isCorridor = current.name.includes('OVER 1.5') || current.name.includes('UNDER 3.5');
        const prevIsCorridor = prev.name.includes('OVER 1.5') || prev.name.includes('UNDER 3.5');
        
        // Boost corridor markets if they are close (within 5%)
        const currentScore = isCorridor ? (current.suretyScore + 5) : current.suretyScore;
        const prevScore = prevIsCorridor ? (prev.suretyScore + 5) : prev.suretyScore;
        
        return (currentScore > prevScore) ? current : prev;
    }, scoredMarkets[0]);

    // 7. Apply Penalties for Structural Conflict
    if (floorAgreement > 1.5) suretyScore -= 20; 
    if (evtRisk > 70) suretyScore -= 15; 
    
    suretyScore = Math.min(100, Math.max(0, suretyScore));

    // 7b. P10 Structural Estimate (Probabilistic Lower Bound)
    // We derive this directly from the Structural Floor mass.
    const floorValue = structuralData.floor;
    let p10Verdict = "P10 ESTIMATE: OVER 0.5";
    if (floorValue > 2.8) p10Verdict = "P10 ESTIMATE: OVER 2.5";
    else if (floorValue > 1.8) p10Verdict = "P10 ESTIMATE: OVER 1.5";
    
    // Confidence is keyed to entropy and survival.
    const p10Confidence = Math.min(100, Math.max(0, (simulation.survivalRating * 0.7) + (signalPrecision * 30)));
    
    // 7c. Mastery Corridor (Nuclear Fortress Anchor)
    let corridorAnchor: 'OVER 1.5' | 'UNDER 3.5' | 'NEUTRAL' = 'NEUTRAL';
    let corridorSurety = 0;

    // Fortress Logic: Prioritize the 1.5 - 3.5 corridor
    if (simulation.survivalRating > 85 && structuralData.floor > 1.8) {
        corridorAnchor = 'OVER 1.5';
        corridorSurety = (simulation.survivalRating * 0.6) + (mirrorSimilarity * 0.4);
    } else if (contextualVolatility > 0.4 && physics.saturation > 0.4) {
        corridorAnchor = 'UNDER 3.5';
        corridorSurety = (100 - evtRisk) * 0.5 + (physics.saturation * 50);
    }

    // 8. Assign Forensic Verdict (TRIPLE-LOCK INTEGRATION)
    let verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID' = 'BRONZE';
    let auditNote = localAuditNote;

    const hasNuclearFloor = floorValue > 1.8; // Must be at least Over 1.5 Bolted
    const isProsecutorHappy = prosecutionRisk < 45; // Low risk from Inversion Audit
    const isStressTestStrong = simulation.survivalRating > 88; // High survival in disaster simulations
    const isEntropyHigh = modelAudit.entropy > 0.7; // Too much noise

    // 8b. Statistical Fortress Protocol (Convergence Check)
    // We check for high-confidence alignment while applying the Adaptive Thresholds
    // derived above to prevent overfitting to specific decimal points.

    const fortressChecks = [
        { met: floorValue > adpFloorThreshold, label: `Adaptive Floor > ${adpFloorThreshold.toFixed(2)}` },
        { met: simulation.survivalRating > adpSurvivalThreshold, label: `Survival > ${adpSurvivalThreshold.toFixed(1)}%` },
        { met: signalPrecision > adpPrecisionThreshold, label: `Signal Stability > ${adpPrecisionThreshold.toFixed(2)}` },
        { met: prosecutionRisk < adpProsecutionThreshold, label: `Inversion Risk < ${adpProsecutionThreshold.toFixed(0)}%` },
        { met: physics.metAudit && physics.saturation < adpSaturationThreshold, label: `Physics: Spatial Capacity Guard` },
        { met: market.syndicateFlow === 'HIGH', label: "Hard Gate: Professional Syndicate Alignment" },
        { met: neuralCoherence >= 0.75, label: "Neural Coherence: Module Alignment" },
        { met: modelAudit.gradientBoosting > 0.6, label: "Structural Boosting Confidence" }
    ];

    const isNuclearFortress = fortressChecks.every(c => c.met) && neuralCoherence === 1.0;
    const fortressReasoning = fortressChecks.filter(c => c.met).map(c => c.label);

    // Hard Gate: No GOLD/Fortress without Syndicate Alignment, Neural Coherence, or Elite Precision
    const hasSyndicateGate = market.syndicateFlow === 'HIGH';

    if (signalPrecision < 0.45 || neuralCoherence < 0.5) {
        verdict = 'VOID';
        auditNote = "REJECTED: Signal precision or Neural Coherence too low. Systemic data rupture.";
    } else if (isNuclearFortress) {
        verdict = 'GOLD';
        auditNote = "NUCLEAR FORTRESS: Absolute convergence detected in the 1.5-3.5 corridor.";
    } else if (suretyScore > 96 && hasNuclearFloor && isProsecutorHappy && isStressTestStrong && hasSyndicateGate && physics.metAudit && neuralCoherence >= 0.75) {
        verdict = 'GOLD';
        auditNote = "MEDALLION SURETY: Elite alignment with hard neural and syndicate gates fulfilled.";
    } else if (suretyScore > 85 && physics.metAudit && neuralCoherence >= 0.5) {
        verdict = 'SILVER';
        auditNote = "Strong structural alignment with tightened neural controls.";
    } else if (suretyScore < 50 || evtRisk > 80 || neuralCoherence < 0.25) {
        verdict = 'VOID';
        auditNote = "Structural rupture, extreme tail risk, or neural divergence detected.";
    }

    return {
        suretyScore,
        evtTailRisk: evtRisk,
        signalPrecision,
        physicsAudit: physics,
        contextualVolatility,
        verdict,
        auditNote,
        isMedallionSurety: verdict === 'GOLD',
        isNuclearFortress,
        fortressReasoning,
        cushionFloor: structuralData.cushion,
        p10StructuralEstimate: {
            verdict: p10Verdict,
            confidence: p10Confidence,
            reasoning: `P10 ESTIMATE: Match mass of ${floorValue.toFixed(2)} indicates a high-confidence lower bound.`
        },
        masteryCorridor: {
            anchor: corridorAnchor,
            surety: corridorSurety
        },
        marketAudits: scoredMarkets,
        bestBet,
        survivalRating: simulation.survivalRating,
        mirrorSimilarity,
        prosecutionRisk: prosecution.riskScore
    };
};
