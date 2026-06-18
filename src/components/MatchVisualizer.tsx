
import React from 'react';
import { RegimeState } from '../types';
import { motion } from 'motion/react';

interface MatchVisualizerProps {
    path: RegimeState[];
}

export const MatchVisualizer: React.FC<MatchVisualizerProps> = ({ path }) => {
    const getRegimeColor = (regime: string) => {
        switch (regime) {
            case 'CHAOTIC_DECAY': return 'from-red-600 to-orange-600';
            case 'FLUID_TRANSITION': return 'from-blue-600 to-indigo-600';
            case 'HIGH_SATURATION': return 'from-green-600 to-emerald-600';
            default: return 'from-slate-600 to-slate-700';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">
                <span>Kickoff Sequence</span>
                <span>FT Saturation</span>
            </div>
            
            <div className="h-24 flex items-end gap-1.5 px-2">
                {path.map((step, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${step.intensity}%` }}
                        transition={{ delay: i * 0.05, type: 'spring', damping: 15 }}
                        className={`flex-1 rounded-t-sm bg-gradient-to-t ${getRegimeColor(step.regime)} opacity-80 hover:opacity-100 transition-opacity cursor-help relative group`}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                            <div className="bg-slate-900 border border-slate-800 p-2 rounded shadow-xl whitespace-nowrap">
                                <p className="text-[10px] font-bold text-white uppercase tracking-tighter mb-1">{step.regime.replace(/_/g, ' ')}</p>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] text-slate-500 font-mono">INT: <span className="text-blue-400">{step.intensity.toFixed(1)}</span></span>
                                    <span className="text-[10px] text-slate-500 font-mono">CONF: <span className="text-green-400">{(step.confidence * 100).toFixed(0)}%</span></span>
                                </div>
                            </div>
                            <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-800 rotate-45 mx-auto -mt-1" />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-4 gap-2 text-[8px] uppercase tracking-widest font-bold text-slate-600 pt-1 text-center">
                <span>0'</span>
                <span>30'</span>
                <span>60'</span>
                <span>90'</span>
            </div>
        </div>
    );
};
