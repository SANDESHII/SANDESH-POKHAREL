import { 
    TeamStats, 
    AnalysisConfidence, 
    MatchContext, 
    AnalysisResult
} from '../types';
import { DixonColes } from '../core/dixonColes';
import { MonteCarloSimulator } from '../core/monteCarlo';
import { ViterbiDecoder } from '../core/viterbi';
import { EdgeCalculator } from '../market/edgeCalculator';
import { KellyCriterion } from '../staking/kellyCriterion';
import { LogisticEnsemble } from '../ensemble/secondModel';
import { AgreementScorer } from '../ensemble/agreement';

export class MatchEngine {
    /**
     * MAIN PREDICTION PIPELINE
     */
    static calculateMatchExpectancy(
        home: TeamStats, 
        away: TeamStats, 
        context: MatchContext,
        marketOdds?: { over15: number; under35: number },
        rhoData: { rho: number, sigmaRho: number } = { rho: -0.11, sigmaRho: 0.05 }
    ): AnalysisResult {
        // 1. Initial Goal Expectancy (Lambda/Mu)
        const hScoring = home.npxG * (1 / away.defensiveStability);
        const aScoring = away.npxG * (1 / home.defensiveStability);
        
        // 2. Statistical Core (Dixon-Coles Matrix)
        const { rho, sigmaRho } = rhoData;
        const matrix = DixonColes.calculateScoreMatrix(hScoring, aScoring, rho);
        
        const pOver15 = DixonColes.calculateOverUnder(matrix, 1.5);
        const pUnder35 = DixonColes.calculateOverUnder(matrix, 3.5);
        const outcomes = DixonColes.calculateMatchOutcomes(matrix);

        // 3. Ensemble Verification
        const logisticPOver15 = LogisticEnsemble.predictOver15(home, away, context);
        const agreement = AgreementScorer.calculate(pOver15, logisticPOver15);

        // 4. Monte Carlo Simulation (Parameter Uncertainty Propagation)
        const simulation = MonteCarloSimulator.run(
            hScoring, 
            aScoring, 
            home.npxGVariance || 0.15, 
            away.npxGVariance || 0.15,
            rho,
            sigmaRho
        );

        // 4. Tactical Decoding (Viterbi)
        const viterbiPaths = ViterbiDecoder.findTopTacticalPaths(hScoring, aScoring, context);
        const optimalPath = viterbiPaths[0];

        // 5. Multi-Lock Verification
        const lock1 = pOver15 > 0.72 || pUnder35 > 0.76;
        const lock2 = agreement.divergence < 0.10; // Genuine independent confirmation (< 10 pts)
        const lock3 = (home.form.reduce((a, b) => a + b, 0) / home.form.length) > 0.45;
        const lock4 = (home.dataPurity || 1.0) > 0.4 && (away.dataPurity || 1.0) > 0.4;
        const lock5 = simulation.stdDev < 1.8; 
        
        const lockCount = [lock1, lock2, lock3, lock4, lock5].filter(Boolean).length;

        // 6. Selection Logic
        const oBaseline = 0.72;
        const uBaseline = 0.76;
        const oEdge = pOver15 / oBaseline;
        const uEdge = pUnder35 / uBaseline;
        
        const type: 'OVER_15' | 'UNDER_35' = oEdge > uEdge ? 'OVER_15' : 'UNDER_35';
        const prob = type === 'OVER_15' ? pOver15 : pUnder35;
        
        // STRICT HONESTY: If purity is < 20%, we withhold the prediction entirely
        const avgPurity = ((home.dataPurity || 0) + (away.dataPurity || 0)) / 2;
        const isInsufficient = avgPurity < 0.2;
        const isVoid = isInsufficient || prob < 0.58 || lockCount < 1 || agreement.isRedFlag;

        // 7. Market & Staking
        let marketData;
        let staking;
        if (marketOdds && !isInsufficient) {
            marketData = EdgeCalculator.analyze(pOver15, {
                ...marketOdds,
                under15: 1 / (1 - 0.7), // Fallback if missing
                homeWin: 1 / outcomes.home,
                draw: 1 / outcomes.draw,
                awayWin: 1 / outcomes.away
            });
            
            const edge = type === 'OVER_15' ? marketData.edge.over15 : marketData.edge.under35;
            const odds = type === 'OVER_15' ? marketOdds.over15 : marketOdds.under35;
            
            if (edge > 0) {
                staking = KellyCriterion.calculate(prob, odds);
            }
        }

        const surety = this.calculateConfidenceAudit(prob, optimalPath.likelihood, Math.round(avgPurity * 100));

        const predictionLabel = isInsufficient 
            ? 'INSUFFICIENT DATA' 
            : (isVoid ? 'NO CLEAR SIGNAL' : (type === 'OVER_15' ? 'Over 1.5 Goals' : 'Under 3.5 Goals'));

        const summary = isInsufficient
            ? "Prediction withheld: The ingestion engine could not verify high-fidelity historical data or real-time signals for this match."
            : (agreement.isRedFlag 
                ? "Match voided: Significant divergence detected between Poisson and Form-based models (Red Flag)." 
                : `${predictionLabel} projected with ${Math.round(prob * 100)}% confidence based on Dixon-Coles Poisson variance.`);

        return {
            probability: Math.round(prob * 100),
            summary,
            predictionType: isVoid ? 'VOID' : type,
            predictionLabel,
            homeXG: hScoring,
            awayXG: aScoring,
            dependence: rho,
            homeStats: home,
            awayStats: away,
            tacticalPath: optimalPath.phases,
            verifiedOptimalPath: optimalPath,
            minimumExpectancy: simulation.confidenceInterval[0],
            potentialCeiling: simulation.confidenceInterval[1],
            lockCount,
            purity: Math.round((home.dataPurity || 1.0) * 50 + (away.dataPurity || 1.0) * 50),
            signalStrength: prob, // Disconnected from Viterbi/Tactical path
            isSureshot: prob > 0.82 && lockCount >= 3 && !isVoid,
            context,
            simulation,
            marketData,
            staking,
            surety,
            marketIndicators: {
                volume: 'Standard',
                sentimentScore: 0.5
            },
            modelAudit: {
                signalPurity: (home.dataPurity || 1.0),
                analysisStability: avgPurity, // Use data purity instead of Viterbi for stability
                signalStrength: prob,
                noiseRatio: 1 - (home.dataPurity || 1.0)
            }
        };
    }

    static calculateConfidenceAudit(prob: number, _likelihood: number, purity: number): AnalysisConfidence {
        // Disconnected likelihood (Viterbi) from the score calculation
        const score = (prob * 0.7) + (purity / 100 * 0.3);
        
        let verdict: AnalysisConfidence['verdict'] = 'BRONZE';
        if (score > 0.85) verdict = 'GOLD';
        else if (score > 0.72) verdict = 'SILVER';
        
        const reasons = [];
        if (purity > 80) reasons.push("High-fidelity historical data integration.");
        if (prob > 0.75) reasons.push("Significant statistical edge detected.");

        return {
            confidenceScore: score,
            verdict,
            analysisReasoning: reasons.length > 0 ? reasons : ["Standard model alignment."]
        };
    }
}
