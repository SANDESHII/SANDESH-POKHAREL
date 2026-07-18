
import React from 'react';
import { motion } from 'motion/react';
import { Target, Crown, Zap, Shield } from 'lucide-react';
import { AnalysisResult } from '../../types';

interface VerifiedPredictionProps {
    analysis: AnalysisResult;
}

export const VerifiedPrediction: React.FC<VerifiedPredictionProps> = ({ analysis }) => {
    const path = analysis.verifiedOptimalPath;
    if (!path) return null;

    const isQuadLock = analysis.isSureshot || analysis.lockCount === 4;
    const isOver15 = analysis.predictionType === 'OVER_15';
    const isUnder35 = analysis.predictionType === 'UNDER_35';
    
    // Define theme based on status
    const getTheme = () => {
        if (isQuadLock) return {
            accent: 'cyan-400',
            bg: 'bg-cyan-500/5',
            border: 'border-cyan-500/30',
            iconBg: 'bg-cyan-500/20',
            iconBorder: 'border-cyan-500/40',
            badge: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
            icon: Crown,
            label: 'CONSOLIDATED SIGNAL',
            badgeLabel: 'HIGH SURETY'
        };
        if (isOver15) return {
            accent: 'blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/50',
            iconBg: 'bg-blue-500/20',
            iconBorder: 'border-blue-500/40',
            badge: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
            icon: Zap,
            label: 'OVER 1.5 TARGET',
            badgeLabel: 'HIGH CONVERGENCE'
        };
        if (isUnder35) return {
            accent: 'purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/50',
            iconBg: 'bg-purple-500/20',
            iconBorder: 'border-purple-500/40',
            badge: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
            icon: Shield,
            label: 'UNDER 3.5 TARGET',
            badgeLabel: 'HIGH CONVERGENCE'
        };
        return {
            accent: 'zinc-500',
            bg: 'bg-zinc-500/5',
            border: 'border-zinc-500/20',
            iconBg: 'bg-zinc-500/10',
            iconBorder: 'border-zinc-500/30',
            badge: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500',
            icon: Target,
            label: 'Logic Prediction',
            badgeLabel: 'VERIFYING'
        };
    };

    const theme = getTheme();
    const Icon = theme.icon;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${theme.bg} ${theme.border} border rounded-2xl p-8 space-y-6 relative overflow-hidden group mb-10 shadow-2xl ${(isQuadLock || isOver15 || isUnder35) ? `ring-1 ${isQuadLock ? 'ring-cyan-500/20' : (isOver15 ? 'ring-blue-500/20' : 'ring-purple-500/20')}` : ''}`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon className={`w-24 h-24 text-${theme.accent}`} />
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${theme.iconBg} flex items-center justify-center border ${theme.iconBorder}`}>
                    <Icon className={`w-6 h-6 text-${theme.accent} ${(isQuadLock || isOver15) ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className={`text-[10px] font-black text-${theme.accent} uppercase tracking-[0.3em]`}>
                            {theme.label}
                        </h3>
                        <span className={`px-2 py-0.5 ${theme.badge} rounded text-[8px] font-black uppercase tracking-widest`}>
                            {theme.badgeLabel}
                        </span>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight uppercase">
                        {analysis.predictionType === 'VOID' ? "NO CLEAR SIGNAL" : analysis.prediction}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Model Confidence</span>
                    <p className="text-xl font-black text-white">{analysis.probability}%</p>
                    {analysis.simulation && (
                        <p className="text-[9px] font-bold text-zinc-500 tracking-tighter">
                            Range: {(analysis.simulation.confidenceInterval[0] * 100).toFixed(1)}% — {(analysis.simulation.confidenceInterval[1] * 100).toFixed(1)}%
                        </p>
                    )}
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Tactical Convergence</span>
                    <p className="text-xl font-black text-white">{((path.likelihood || 0.5) * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Signal Purity</span>
                    <p className="text-xl font-black text-white">{((analysis.modelAudit?.signalPurity || 0.9) * 100).toFixed(1)}%</p>
                </div>
            </div>
        </motion.div>
    );
};
