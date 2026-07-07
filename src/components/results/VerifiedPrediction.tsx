
import React from 'react';
import { motion } from 'motion/react';
import { Target, Activity, Crown, Zap } from 'lucide-react';
import { AnalysisResult } from '../../types';

interface VerifiedPredictionProps {
    analysis: AnalysisResult;
}

export const VerifiedPrediction: React.FC<VerifiedPredictionProps> = ({ analysis }) => {
    const path = analysis.verifiedOptimalPath;
    if (!path) return null;

    const isQuadLock = analysis.isSureshot || analysis.lockCount === 4;

    let accentClass = 'text-zinc-500';
    let bgClass = 'bg-zinc-500/5';
    let borderClass = 'border-zinc-500/20';
    let iconBgClass = 'bg-zinc-500/10';
    let iconBorderClass = 'border-zinc-500/30';
    let badgeClass = 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500';

    const isOver15 = analysis.predictionType === 'OVER_15';

    if (isQuadLock) {
        accentClass = 'text-cyan-400';
        bgClass = 'bg-cyan-500/5';
        borderClass = 'border-cyan-500/30';
        iconBgClass = 'bg-cyan-500/20';
        iconBorderClass = 'border-cyan-500/40';
        badgeClass = 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400';
    } else if (isOver15) {
        accentClass = 'text-blue-400';
        bgClass = 'bg-blue-500/10';
        borderClass = 'border-blue-500/50';
        iconBgClass = 'bg-blue-500/20';
        iconBorderClass = 'border-blue-500/40';
        badgeClass = 'bg-blue-500/20 border-blue-500/30 text-blue-400';
    }

    const Icon = isQuadLock ? Crown : (isOver15 ? Zap : Target);

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${bgClass} ${borderClass} border rounded-2xl p-8 space-y-6 relative overflow-hidden group mb-10 shadow-2xl ${isQuadLock || isOver15 ? `ring-1 ${isQuadLock ? 'ring-cyan-500/20' : 'ring-blue-500/20'}` : ''}`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {isQuadLock ? <Crown className={`w-24 h-24 ${accentClass}`} /> : (isOver15 ? <Zap className={`w-24 h-24 ${accentClass}`} /> : <Activity className={`w-24 h-24 ${accentClass}`} />)}
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${iconBgClass} flex items-center justify-center border ${iconBorderClass}`}>
                    <Icon className={`w-6 h-6 ${accentClass} ${isQuadLock || isOver15 ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className={`text-[10px] font-black ${accentClass} uppercase tracking-[0.3em]`}>
                            {isQuadLock ? 'ABSOLUTE ZERO SIGNAL' : (isOver15 ? 'OVER 1.5 SIGNAL' : 'Quant Prediction')}
                        </h3>
                        <span className={`px-2 py-0.5 ${badgeClass} rounded text-[8px] font-black uppercase tracking-widest`}>
                            {isQuadLock ? 'SURESHOT' : (isOver15 ? 'HIGH CONVERGENCE' : 'PRE-VERIFICATION')}
                        </span>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight uppercase">
                        {isQuadLock ? analysis.prediction : (analysis.predictionType === 'VOID' ? "NO CLEAR SIGNAL" : analysis.prediction)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Confidence</span>
                    <p className="text-xl font-black text-white">{((path.accuracyScore || 0.8) * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Convergence</span>
                    <p className="text-xl font-black text-white">{((path.likelihood || 0.5) * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-zinc-600 uppercase">Purity Score</span>
                    <p className="text-xl font-black text-white">{((analysis.modelAudit?.signalPurity || 0.9) * 100).toFixed(1)}%</p>
                </div>
            </div>
        </motion.div>
    );
};
