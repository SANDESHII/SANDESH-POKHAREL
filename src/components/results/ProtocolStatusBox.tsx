
import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, Crown, Info, Activity, AlertTriangle } from 'lucide-react';
import { AnalysisResult } from '../../types';

interface ProtocolStatusBoxProps {
    analysis: AnalysisResult;
}

export const ProtocolStatusBox: React.FC<ProtocolStatusBoxProps> = ({ analysis }) => {
    const isQuadLock = analysis.lockCount === 4 || analysis.isSureshot;
    const theme = isQuadLock 
        ? { accent: 'cyan', text: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-950/20', shadow: 'shadow-cyan-500/10' }
        : { accent: 'zinc', text: 'text-zinc-500', border: 'border-zinc-800', bg: 'bg-zinc-950/40', shadow: 'shadow-none' };

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full ${theme.bg} border ${theme.border} ${theme.shadow} rounded-3xl p-8 md:p-10 mb-10 relative overflow-hidden`}
        >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-64 h-64 ${isQuadLock ? 'bg-cyan-500/5' : 'bg-zinc-500/5'} blur-[100px] -mr-32 -mt-32`} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
                {/* Left Column: Verification Identity */}
                <div className="lg:col-span-5 space-y-8 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-zinc-900 pb-10 lg:pb-0 lg:pr-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isQuadLock ? 'bg-cyan-500/20 border border-cyan-500/40' : 'bg-zinc-900 border border-zinc-800'}`}>
                            {isQuadLock ? <Crown className="w-6 h-6 text-cyan-400" /> : <Shield className="w-6 h-6 text-zinc-500" />}
                        </div>
                        <div>
                            <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] ${analysis.provenance === 'HEURISTIC_FALLBACK' ? 'text-amber-500' : (isQuadLock ? 'text-cyan-500' : 'text-zinc-500')}`}>
                                {analysis.provenance === 'HEURISTIC_FALLBACK' ? 'Historical Baseline Protocol' : (isQuadLock ? 'Nuclear Fortress Protocol' : 'Standard Verification')}
                            </h2>
                            <p className="text-xl font-black text-white uppercase tracking-tight">
                                {analysis.provenance === 'HEURISTIC_FALLBACK' ? 'Heuristic Analysis' : (isQuadLock ? 'Quad-Lock Active' : 'Pre-Signal Status')}
                            </p>
                        </div>
                    </div>

                    {analysis.marketData?.isSimulated && (
                        <div className="mt-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 w-fit">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                Simulated Market Data
                            </span>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Primary Prediction</h3>
                            <div className="flex items-center gap-3">
                                <p className={`text-3xl font-black uppercase tracking-tighter ${isQuadLock ? 'text-white' : 'text-zinc-400'}`}>
                                    {analysis.prediction || "ANALYZING..."}
                                </p>
                                {isQuadLock && (
                                    <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                                        SIGNAL_LOCKED
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-end gap-2">
                                <span className={`text-7xl font-black tracking-tighter ${isQuadLock ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'text-zinc-400'}`}>
                                    {analysis.probability}%
                                </span>
                                <span className="text-xs font-black text-zinc-600 uppercase mb-2">Probability</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${analysis.probability}%` }}
                                    className={`h-full ${isQuadLock ? 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-zinc-700'}`}
                                />
                            </div>
                            {analysis.provenance === 'HEURISTIC_FALLBACK' || analysis.modelAudit.signalPurity < 0.4 ? (
                                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <Shield className="w-3 h-3 text-amber-500" />
                                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
                                        {analysis.provenance === 'HEURISTIC_FALLBACK' ? 'Heuristic Analysis Active' : 'Low Purity Signal Detected'}
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <Zap className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">AI Grounding Confirmed</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Narrative & Physics */}
                <div className="lg:col-span-7 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Info className="w-3 h-3 text-zinc-600" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Match Physics & Calculation Narrative</h3>
                        </div>
                        <p className="text-sm md:text-base text-zinc-300 leading-relaxed font-medium">
                            {analysis.summary}
                        </p>
                        <div className="p-4 bg-black/40 border border-zinc-900 rounded-xl">
                            <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                                <span className="text-zinc-300 font-bold uppercase mr-2 tracking-tighter">Calculation Basis:</span>
                                {analysis.verifiedOptimalPath?.label || 'Physics-based multi-variate regression analysis active.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-zinc-900">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <Activity className="w-3 h-3 text-cyan-500" />
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tactical Drift: {analysis.context.tacticalDrift}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Market Entropy: {analysis.marketIndicators.volume}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <Shield className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Physics State: {analysis.context.weather} Stable</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
