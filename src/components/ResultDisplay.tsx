
import React from 'react';
import { AnalysisResult } from '../types';
import { MedallionResult } from '../services/suretyService';
import { StatCard } from './StatCard';
import { Zap, Shield, Target, Flame, Dna, Crosshair, BarChart3, Activity } from 'lucide-react';
import { MatchVisualizer } from './MatchVisualizer';

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: MedallionResult;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 focus:outline-none">
            <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        label="Success Index" 
                        value={`${analysis.probability}%`} 
                        subValue={analysis.homeStats.name}
                        icon={Zap} 
                        color="green"
                    />
                    <StatCard 
                        label="Structural Floor" 
                        value={analysis.structuralFloor.toFixed(2)} 
                        subValue="GOALS"
                        icon={Shield} 
                        color="blue"
                    />
                    <StatCard 
                        label="Physical Ceiling" 
                        value={analysis.physicalCeiling.toFixed(2)} 
                        subValue="LIMIT"
                        icon={Target} 
                        color="purple"
                    />
                </div>

                <div className="bg-zinc-950 border border-emerald-900/30 rounded-2xl p-10 space-y-10 shadow-2xl">
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-900 border-b border-emerald-900/20 pb-6 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Structural Integrity Visualization
                        </h3>
                        <MatchVisualizer path={analysis.regimePath} />
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-900 border-b border-emerald-900/20 pb-6 flex items-center gap-2">
                            <Zap className="w-3 h-3" /> Core Intelligence Summary
                        </h3>
                        <p className="text-base text-emerald-500 font-bold leading-relaxed uppercase tracking-tight opacity-90">
                            {analysis.summary}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {analysis.homeStats.name} Perspective
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-emerald-950 uppercase font-black tracking-widest">Expected Goals</span>
                                    <p className="text-3xl font-black text-white">{analysis.homeXG.toFixed(2)}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-emerald-950 uppercase font-black tracking-widest">Attack Power</span>
                                    <p className="text-3xl font-black text-emerald-500">{analysis.homeStats.xT.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6 md:border-l md:border-emerald-900/20 md:pl-10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {analysis.awayStats.name} Perspective
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-emerald-950 uppercase font-black tracking-widest">Expected Goals</span>
                                    <p className="text-3xl font-black text-white">{analysis.awayXG.toFixed(2)}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-emerald-950 uppercase font-black tracking-widest">Attack Power</span>
                                    <p className="text-3xl font-black text-emerald-400">{analysis.awayStats.xT.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-10">
                <div className="bg-emerald-950/20 border border-emerald-500/30 p-12 rounded-2xl text-center space-y-10 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 space-y-3">
                        <span className="text-[10px] uppercase font-black tracking-[0.5em] text-emerald-900">Execution Verdict</span>
                        <h2 className="text-7xl font-black italic tracking-tighter uppercase text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                            {surety.verdict}
                        </h2>
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-center text-emerald-900 border-b border-emerald-900/30 pb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest">Signal Surety</span>
                            <span className="text-2xl font-black italic text-emerald-500">{surety.suretyScore.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 font-bold uppercase leading-relaxed text-left italic">
                            {surety.auditNote}
                        </p>
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center justify-between p-5 bg-black border border-emerald-900/30 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-emerald-900">Target:</span>
                            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest">{surety.bestBet?.name || '---'}</span>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-black border border-emerald-900/30 rounded-xl">
                            <span className="text-[10px] uppercase font-black text-emerald-900">Safety:</span>
                            <span className="text-xs font-black text-emerald-500 italic tracking-widest">{surety.survivalRating.toFixed(0)}%</span>
                        </div>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
                </div>

                <div className="space-y-6 p-6 bg-zinc-950 border border-emerald-900/30 rounded-2xl shadow-2xl">
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-emerald-900 flex items-center gap-2">
                        <BarChart3 className="w-3 h-3" /> Empirical Risk Matrix
                    </h4>
                    <div className="space-y-4">
                        {surety.fortressReasoning.slice(0, 3).map((reason, i) => (
                            <div key={i} className="flex gap-3">
                                <span className="text-emerald-500 font-black text-[10px]">//</span>
                                <p className="text-[10px] font-bold text-emerald-900 uppercase leading-relaxed">
                                    {reason}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
