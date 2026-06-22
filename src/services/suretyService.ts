
import { TeamStats, RegimeState, MatchContext, MarketReality, MirrorMatch, ProsecutionCase, ModelAudit } from '../types';
import { SimulationResult, MarketAudit } from './monteCarloService';

export interface MedallionResult {
    suretyScore: number;
    forensicIntegrity: number;
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
 */
export const calculateContextualVolatility = (context: MatchContext): number => {
    let friction = 0.2;
    friction += (context.historicalRivalry / 10) * 0.3;
    const stakesLower = context.stakes.toLowerCase();
    if (stakesLower.includes('final') || stakesLower.includes('relegation') || stakesLower.includes('derby')) {
        friction += 0.2;
    }
    return Math.min(1.0, friction);
};

/**
 * Medallion Surety Calculation (Forensic Protocol)
 */
export const calculateMedallionSurety = (
    simulation: SimulationResult,
    regimePath: RegimeState[],
    structuralData: { floor: number, cushion: number },
    signalPrecision: number,
    physics: { metAudit: boolean, saturation: number },
    market: MarketReality,
    context: MatchContext,
    mirrorMatches: MirrorMatch[],
    prosecution: ProsecutionCase,
    modelAudit: ModelAudit
): MedallionResult => {
    const contextualVolatility = calculateContextualVolatility(context);
    
    const adpFloorThreshold = 2.15 + (contextualVolatility * 0.35); 
    const adpSurvivalThreshold = 97 - (signalPrecision * 3); 
    const adpPrecisionThreshold = 0.90 + (contextualVolatility * 0.03);
    const adpSaturationThreshold = 0.60 - (contextualVolatility * 0.20); 

    const successfulMirrors = mirrorMatches.filter(m => m.result.includes('Win') || m.result.includes('Over') || m.result.includes('Goals')).length;
    const mirrorSimilarity = (successfulMirrors / (mirrorMatches.length || 1)) * 100;

    const physicsMass = physics.metAudit ? 1 : (physics.integrityScore > 0.8 ? 0.5 : 0);
    const statisticalMass = Math.min(1.0, Math.max(0, (simulation.survivalRating - 40) / 50));
    const marketMass = market.syndicateFlow === 'HIGH' ? 1 : (market.syndicateFlow === 'MEDIUM' ? 0.6 : 0.2);
    const mirrorMass = Math.min(1.0, Math.max(0, (mirrorSimilarity - 40) / 50));
    const neuralCoherence = (physicsMass + statisticalMass + marketMass + mirrorMass) / 4;

    const prosecutionRisk = prosecution.riskScore;
    const combinedIntensity = regimePath.reduce((acc, s) => acc + s.intensity, 0) / regimePath.length;
    const floorAgreement = Math.abs(structuralData.floor - (combinedIntensity / 40));
    
    // Base Surety: Strictly aligned with Forensic Integrity
    let suretyScore = (simulation.probability * 0.3) + (simulation.survivalRating * 0.3) + (mirrorSimilarity * 0.2) + (modelAudit.forensicIntegrity * 20);
    let localAuditNote = "Forensic audit complete.";

    if (prosecutionRisk > 60) {
        suretyScore -= (prosecutionRisk * 0.25);
        localAuditNote = "INVERSION AUDIT: Structural contradictions detected.";
    }

    if (signalPrecision < 0.5) {
        suretyScore = Math.min(suretyScore, 65);
        localAuditNote = "REJECTED: Signal precision too low.";
    } 

    if (!physics.metAudit) {
        suretyScore -= 25;
        localAuditNote = "PHYSICS AUDIT FAILED: MET exceeds tactical capacity.";
    }
    
    if (contextualVolatility > 0.85 && signalPrecision < 0.75) {
        suretyScore -= 40; 
        localAuditNote = "VOLATILITY KILL SWITCH: Extreme noise detected.";
    }

    const scoredMarkets = simulation.marketAudits.map(audit => {
        const marketSurety = ((audit.rawProb * 0.6) + (signalPrecision * 100) * 0.4);
        return {
            ...audit,
            regimeAlignment: 0,
            suretyScore: Math.min(100, Math.max(0, marketSurety))
        };
    });

    const bestBet = scoredMarkets.reduce((prev, current) => {
        return (current.suretyScore > prev.suretyScore) ? current : prev;
    }, scoredMarkets[0]);

    if (floorAgreement > 1.5) suretyScore -= 20; 
    
    suretyScore = Math.min(100, Math.max(0, suretyScore));

    const floorValue = structuralData.floor;
    let p10Verdict = "P10 ESTIMATE: OVER 0.5";
    if (floorValue > 2.8) p10Verdict = "P10 ESTIMATE: OVER 2.5";
    else if (floorValue > 1.8) p10Verdict = "P10 ESTIMATE: OVER 1.5";
    
    const p10Confidence = Math.min(100, Math.max(0, (simulation.survivalRating * 0.7) + (signalPrecision * 30)));
    
    let corridorAnchor: 'OVER 1.5' | 'UNDER 3.5' | 'NEUTRAL' = 'NEUTRAL';
    let corridorSurety = 0;

    if (simulation.survivalRating > 72 && structuralData.floor > 1.35) {
        corridorAnchor = 'OVER 1.5';
        corridorSurety = (simulation.survivalRating * 0.6) + (mirrorSimilarity * 0.4);
    } 
    else if (physics.saturation > 0.52 && structuralData.floor < 2.9) {
        corridorAnchor = 'UNDER 3.5';
        corridorSurety = (100 - (1 - signalPrecision) * 100) * 0.4 + (physics.saturation * 60);
    }

    let verdict: 'GOLD' | 'SILVER' | 'BRONZE' | 'VOID' = 'BRONZE';
    const isNuclearFortress = (simulation.survivalRating > adpSurvivalThreshold && signalPrecision > adpPrecisionThreshold && neuralCoherence === 1.0);

    if (signalPrecision < 0.45 || neuralCoherence < 0.25) {
        verdict = 'VOID';
        localAuditNote = "REJECTED: Systemic data rupture.";
    } else if (isNuclearFortress) {
        verdict = 'GOLD';
        localAuditNote = "NUCLEAR FORTRESS: Absolute forensic convergence.";
    } else if (suretyScore > 82 && physics.metAudit && neuralCoherence >= 0.5) {
        verdict = 'SILVER';
    } else if (suretyScore > 65) {
        verdict = 'BRONZE';
    } else {
        verdict = 'VOID';
        localAuditNote = "AUDIT: Insufficient pattern convergence.";
    }

    return {
        suretyScore,
        forensicIntegrity: modelAudit.forensicIntegrity,
        signalPrecision,
        physicsAudit: physics,
        contextualVolatility,
        verdict,
        auditNote: localAuditNote,
        isMedallionSurety: verdict === 'GOLD',
        isNuclearFortress,
        fortressReasoning: [],
        cushionFloor: structuralData.cushion,
        p10StructuralEstimate: {
            verdict: p10Verdict,
            confidence: p10Confidence,
            reasoning: `P10 ESTIMATE: Match mass of ${floorValue?.toFixed(2) || '0.00'} detected.`
        },
        masteryCorridor: {
            anchor: corridorAnchor,
            surety: corridorSurety
        },
        marketAudits: scoredMarkets,
        bestBet,
        survivalRating: simulation.survivalRating,
        mirrorSimilarity,
        prosecutionRisk
    };
};
