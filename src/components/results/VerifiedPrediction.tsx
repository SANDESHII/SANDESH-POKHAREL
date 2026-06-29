
import React from 'react';
import { motion } from 'motion/react';
import { Shield, Target, CheckCircle2, Activity } from 'lucide-react';
import { AnalysisResult } from '../../types';

interface VerifiedPredictionProps {
    analysis: AnalysisResult;
}

export const VerifiedPrediction: React.FC<VerifiedPredictionProps> = ({ analysis }) => {
    const path = analysis.verifiedOptimalPath;
    if (!path) return null;

    const hasSignal = analysis.probability >= 70;
    const isOver15 = analysis.prediction?.includes('OVER 1.5');
    const isUnder35 = analysis.prediction?.includes('UNDER 3.5');

    let accentClass = 'text-zinc-500';
    let bgClass = 'bg-zinc-500/5';
    let borderClass = 'border-zinc-500/20';
    let iconBgClass = 'bg-zinc-500/20';
    let iconBorderClass = 'border-zinc-500/30';
    let badgeClass = 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500';

    if (hasSignal) {
        if (isOver15) {
            accentClass = 'text-emerald-500';
            bgClass = 'bg-emerald-500/5';
            borderClass = 'border-emerald-500/20';
            iconBgClass = 'bg-emerald-500/20';
            iconBorderClass = 'border-emerald-500/30';
            badgeClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
        } else if (isUnder35) {
            accentClass = 'text-blue-500';
            bgClass = 'bg-blue-500/5';
            borderClass = 'border-blue-500/20';
            iconBgClass = 'bg-blue-500/20';
            iconBorderClass = 'border-blue-500/30';
            badgeClass = 'bg-blue-500/10 border-blue-500/20 text-blue-500';
        }
    }

    const Icon = isOver15 ? Shield : Target;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${bgClass} ${borderClass} rounded-2xl p-8 space-y-6 relative overflow-hidden group mb-10 shadow-2xl`}
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {isOver15 ? <CheckCircle2 className={`w-24 h-24 ${accentClass}`} /> : <Activity className={`w-24 h-24 ${accentClass}`} />}
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${iconBgClass} flex items-center justify-center border ${iconBorderClass}`}>
                    <Icon className={`w-6 h-6 ${accentClass}`} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className={`text-[10px] font-black ${accentClass} uppercase tracking-[0.3em]`}>Quant Prediction</h3>
                        <span className={`px-2 py-0.5 ${badgeClass} rounded text-[8px] font-black uppercase tracking-widest`}>
                            {hasSignal ? 'OPTIMAL' : 'LOW_CONFIDENCE'}
                        </span>
                    </div>
                    <p className="text-3xl font-black text-white tracking-tight uppercase">
                        {hasSignal ? analysis.prediction : "RETRY_ANALYSIS"}
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
