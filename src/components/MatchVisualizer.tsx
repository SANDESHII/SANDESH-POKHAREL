
import React from 'react';
import { RegimeState } from '../types';
import { motion } from 'motion/react';

interface MatchVisualizerProps {
    path: RegimeState[];
}

export const MatchVisualizer: React.FC<MatchVisualizerProps> = ({ path }) => {
    const getRegimeColor = (regime: string) => {
        switch (regime) {
            case 'CHAOTIC_DECAY': return 'from-rose-600 to-orange-500';
            case 'FLUID_TRANSITION': return 'from-emerald-600 to-teal-500';
            case 'HIGH_SATURATION': return 'from-emerald-400 to-emerald-600';
            default: return 'from-emerald-950 to-emerald-900';
        }
    };

    return (
        <div className="space-y-6 bg-emerald-950/20 p-6 rounded-2xl border border-emerald-900/30">
            <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] text-emerald-900">
                <span>Initialization</span>
                <span>Structural End</span>
            </div>
            
            <div className="h-28 flex items-end gap-1.5 px-1">
                {path.map((step, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${step.intensity}%` }}
                        transition={{ delay: i * 0.03, type: 'spring', damping: 20 }}
                        className={`flex-1 rounded-t-lg bg-gradient-to-t ${getRegimeColor(step.regime)} opacity-70 hover:opacity-100 transition-opacity cursor-crosshair relative group shadow-lg`}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-20">
                            <div className="bg-zinc-950 border border-emerald-900/50 p-3 rounded-xl shadow-2xl whitespace-nowrap">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 pb-1 border-b border-emerald-900/20">{step.regime.replace(/_/g, ' ')}</p>
                                <div className="flex items-center justify-between gap-6">
                                    <span className="text-[10px] text-emerald-900 font-bold uppercase">Intensity: <span className="text-white">{step.intensity?.toFixed(1) || '0.0'}</span></span>
                                    <span className="text-[10px] text-emerald-900 font-bold uppercase">Surety: <span className="text-emerald-500">{((step.confidence || 0) * 100).toFixed(0)}%</span></span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.3em] font-black text-emerald-950 pt-2 text-center">
                <span>00:00</span>
                <span>30:00</span>
                <span>60:00</span>
                <span>90:00</span>
            </div>
        </div>
    );
};
