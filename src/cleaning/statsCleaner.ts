import { TeamStats, Provenance } from '../types';

export class StatsCleaner {
    static outlierGate(val: number, history: number[], threshold: number = 3.5): { value: number; flagged: boolean; severity: number } {
        if (!history || history.length < 5) return { value: val, flagged: false, severity: 0 };

        const sorted = [...history].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const absoluteDeviations = history.map(v => Math.abs(v - median));
        const sortedAD = [...absoluteDeviations].sort((a, b) => a - b);
        const mad = sortedAD.length % 2 !== 0 ? sortedAD[mid] : (sortedAD[mid - 1] + sortedAD[mid]) / 2;

        const modifiedZ = mad === 0 ? 0 : (0.6745 * Math.abs(val - median)) / mad;
        if (modifiedZ > threshold) {
            const corrected = median + Math.sign(val - median) * (threshold * mad / 0.6745);
            return { value: corrected, flagged: true, severity: modifiedZ };
        }
        return { value: val, flagged: false, severity: 0 };
    }

    static clamp(v: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, v));
    }

    static cleanTeamStats(team: Partial<TeamStats>, leagueAvg: number = 1.35): { stats: TeamStats; provenance: Provenance } {
        const h = team.npxGSequence || [], xh = team.avgXGSequence || [], xah = team.xGASequence || [], dh = team.defensiveStabilitySequence || [], oh = team.offensiveVolatilitySequence || [];
        const { value: npxG, flagged: f1, severity: s1 } = this.outlierGate(team.npxG ?? leagueAvg, h);
        const { value: avgXG, flagged: f2, severity: s2 } = this.outlierGate(team.avgXG ?? leagueAvg, xh);
        const { value: avgXGA, flagged: f3, severity: s3 } = this.outlierGate(team.avgXGA ?? leagueAvg, xah);
        const { value: defS, flagged: f4, severity: s4 } = this.outlierGate(team.defensiveStability ?? 0.6, dh);
        const { value: offV, flagged: f5, severity: s5 } = this.outlierGate(team.offensiveVolatility ?? 0.5, oh);

        const flags: string[] = [], imputed: string[] = [], outliers: string[] = [];
        if (f1 || f2 || f3 || f4 || f5) flags.push('OUTLIER_DETECTED');
        [f1, f2, f3, f4, f5].forEach((f, i) => f && outliers.push(['npxG', 'avgXG', 'avgXGA', 'defS', 'offV'][i]));
        ['npxG', 'avgXG', 'avgXGA'].forEach(k => (team as any)[k] == null && imputed.push(k));
        if (imputed.length) flags.push('MISSING_INPUT_IMPUTED');
        if (team.unresolved) flags.push('UNRESOLVED_ENTITY');

        let penalty = 1.0;
        if (team.cleanSheets! > h.length) { flags.push('CLEAN_SHEET_CONTRADICTION'); penalty *= 0.85; }
        if (h.length >= 5 && Math.abs((team.goalsScored || 0) / h.length - (avgXG || 1.35)) > 2.0) { flags.push('SKEWED_STAT_CORRELATION'); penalty *= 0.9; }

        const sampleSize = h.length;
        const sampleMult = sampleSize >= 25 ? 1.0 : Math.max(0.3, 0.4 + 0.6 * (Math.log10(1 + 9 * (sampleSize / 25))));
        const outlierMult = (f1 || f2 || f3 || f4 || f5) ? Math.max(0.2, 0.85 - (Math.max(s1, s2, s3, s4, s5) - 3.5) * 0.1) : 1.0;

        const basePurity = team.dataPurity ?? 0.25;
        const finalPurity = basePurity * outlierMult * sampleMult * penalty * (team.name === 'Unknown' ? 0.5 : 1.0);
        const stats: TeamStats = {
            name: team.name || 'Unknown',
            goalsScored: team.goalsScored || 0,
            goalsConceded: team.goalsConceded || 0,
            avgXG: this.clamp(avgXG, 0.1, 5.0),
            avgXGA: this.clamp(avgXGA, 0.1, 5.0),
            npxG: this.clamp(npxG, 0.1, 5.0),
            defensiveStability: this.clamp(defS, 0.01, 1.0),
            offensiveVolatility: this.clamp(offV, 0.01, 1.0),
            form: team.form || [0.5],
            cleanSheets: team.cleanSheets || 0,
            unresolved: team.unresolved,
            dataPurity: finalPurity,
            npxGVariance: this.clamp(team.npxGVariance ?? 0.15, 0.01, 0.5),
            npxGSequence: h, avgXGSequence: xh, xGASequence: xah, defensiveStabilitySequence: dh, offensiveVolatilitySequence: oh,
            auditLog: {
                imputedFields: imputed, outliersCorrected: outliers, entityResolutionFlags: team.unresolved ? ['UNMAPPED_IDENTIFIER'] : [],
                sampleSize, flags,
                purityBreakdown: { base: basePurity, samplePenalty: sampleMult, outlierPenalty: outlierMult, consistencyPenalty: penalty, sourceMultiplier: team.name === 'Unknown' ? 0.5 : 1.0 }
            }
        };

        return { stats, provenance: { source: team.name === 'Unknown' ? 'IMPUTATION_ENGINE' : 'DATA_PROVIDER', purity: finalPurity, imputed: team.npxG == null || (f1 || f2 || f3 || f4 || f5), flags } };
    }
}

