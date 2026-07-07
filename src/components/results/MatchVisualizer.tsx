
import React from 'react';
import { motion } from 'motion/react';
import { TacticalPhase } from '../../types';

interface MatchVisualizerProps {
    path: TacticalPhase[];
    isOver?: boolean;
}

export const MatchVisualizer: React.FC<MatchVisualizerProps> = ({ path, isOver = true }) => {
    const containerClasses = isOver 
        ? "space-y-6 bg-blue-950/20 p-6 rounded-2xl border border-blue-900/30"
        : "space-y-6 bg-emerald-950/20 p-6 rounded-2xl border border-emerald-900/30";
    
    const labelClasses = isOver 
        ? "flex items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] text-blue-900"
        : "flex items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] text-emerald-900";

    const getStateColor = (state: string) => {
        switch (state) {
            case 'HIGH_VARIANCE': return 'from-rose-600 to-orange-500';
            case 'TRANSITIONAL': return isOver ? 'from-blue-600 to-cyan-500' : 'from-emerald-600 to-teal-500';
            case 'DOMINANT': return isOver ? 'from-blue-400 to-blue-600' : 'from-emerald-400 to-emerald-600';
            default: return isOver ? 'from-blue-950 to-blue-900' : 'from-emerald-950 to-emerald-900';
        }
    };

    return (
        <div className={containerClasses}>
            <div className={labelClasses}>
                <span>Start</span>
                <span>End</span>
            </div>
            <div className="h-28 flex items-end gap-1.5 px-1">
                {path.map((step, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${step.intensity}%` }}
                        transition={{ delay: i * 0.03, type: 'spring', damping: 20 }}
                        className={`flex-1 rounded-t-lg bg-gradient-to-t ${getStateColor(step.state)} opacity-70 hover:opacity-100 transition-opacity cursor-crosshair relative group shadow-lg`}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-20">
                            <div className={`bg-zinc-950 border ${isOver ? 'border-emerald-900/50' : 'border-blue-900/50'} p-3 rounded-xl shadow-2xl whitespace-nowrap`}>
                                <p className={`text-[10px] font-black ${isOver ? 'text-emerald-500' : 'text-blue-500'} uppercase tracking-widest mb-2 pb-1 border-b border-zinc-800`}>
                                    {step.state.replace(/_/g, ' ')}
                                </p>
                                <div className="flex items-center justify-between gap-6">
                                    <span className={`text-[10px] ${isOver ? 'text-emerald-900' : 'text-blue-900'} font-bold uppercase`}>Energy: <span className="text-white">{step.intensity?.toFixed(1) || '0.0'}</span></span>
                                    <span className={`text-[10px] ${isOver ? 'text-emerald-900' : 'text-blue-900'} font-bold uppercase`}>Surety: <span className={isOver ? 'text-emerald-500' : 'text-blue-500'}>{((step.confidence || 0) * 100).toFixed(0)}%</span></span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
            <div className={`grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.3em] font-black ${isOver ? 'text-emerald-950' : 'text-blue-950'} pt-2 text-center`}>
                <span>00:00</span><span>30:00</span><span>60:00</span><span>90:00</span>
            </div>
        </div>
    );
};
