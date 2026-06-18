
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Primary Analysis Dashboard */}
            <div className="lg:col-span-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        label="Structural Win Probability" 
                        value={`${analysis.probability}%`} 
                        subValue={analysis.homeStats.name}
                        icon={Zap} 
                        color="blue"
                    />
                    <StatCard 
                        label="Nuclear Fortress Floor" 
                        value={analysis.structuralFloor.toFixed(2)} 
                        subValue="GOALS"
                        icon={Shield} 
                        color="purple"
                    />
                    <StatCard 
                        label="Institutional Ceiling" 
                        value={analysis.physicalCeiling.toFixed(2)} 
                        subValue="GOALS"
                        icon={Target} 
                        color="green"
                    />
                </div>

                {/* Match Narrative & Visuals */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
                        <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-blue-500" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Stochastic Match DNA</h3>
                        </div>
                        <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 text-[10px] font-bold text-blue-400">
                            MODE: {analysis.modelMode}
                        </div>
                    </div>

                    <MatchVisualizer path={analysis.regimePath} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2 block">Executive Analyst Summary</span>
                            <p className="text-sm text-slate-300 leading-relaxed italic">
                                "{analysis.summary}"
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-900">
                                <span className="text-xs font-medium text-slate-400">Signal Precision</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${analysis.signalPrecision * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-white">{(analysis.signalPrecision * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-900">
                                <span className="text-xs font-medium text-slate-400">Physics Integrity</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${analysis.physics.integrityScore * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-white">{(analysis.physics.integrityScore * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Statistics Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800/50 pb-2">{analysis.homeStats.name} forensic profile</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">NPXG</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.homeStats.npxG.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">X-Threat</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.homeStats.xT.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Defensive Mass</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.homeStats.cleanSheets}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Inferred Strength</span>
                                <p className="text-lg font-mono text-blue-400 font-bold">{analysis.homeXG.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/30 p-6 rounded-2xl border border-slate-800 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800/50 pb-2">{analysis.awayStats.name} forensic profile</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">NPXG</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.awayStats.npxG.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">X-Threat</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.awayStats.xT.toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Defensive Mass</span>
                                <p className="text-lg font-mono text-white font-bold">{analysis.awayStats.cleanSheets}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Inferred Strength</span>
                                <p className="text-lg font-mono text-indigo-400 font-bold">{analysis.awayXG.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Side Terminal: Medallion Surety & Verdict */}
            <div className="lg:col-span-4 space-y-8">
                <div className={`rounded-2xl border ${
                    surety.verdict === 'GOLD' ? 'border-yellow-500/50 bg-yellow-500/5' : 
                    surety.verdict === 'SILVER' ? 'border-slate-400/50 bg-slate-400/5' : 
                    surety.verdict === 'BRONZE' ? 'border-orange-500/50 bg-orange-500/5' : 'border-red-500/50 bg-red-500/5'
                } p-8 relative overflow-hidden`}>
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 p-2">
                        <Dna className="w-16 h-16 opacity-5 -mr-4 -mt-4 rotate-12" />
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="text-center space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-[0.4em] text-slate-500">Security Verdict</span>
                            <h2 className={`text-5xl font-black italic tracking-tighter ${
                                surety.verdict === 'GOLD' ? 'text-yellow-500 py-1 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 
                                surety.verdict === 'SILVER' ? 'text-slate-300' : 
                                surety.verdict === 'BRONZE' ? 'text-orange-500' : 'text-red-500'
                            }`}>
                                {surety.verdict}
                            </h2>
                        </div>

                        <div className="bg-slate-950/80 rounded-xl border border-slate-900 p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-medium font-mono uppercase">System Surety Score</span>
                                <span className={`text-lg font-bold font-mono ${
                                    surety.suretyScore > 90 ? 'text-green-500' : 
                                    surety.suretyScore > 75 ? 'text-blue-500' : 'text-orange-500'
                                }`}>
                                    {surety.suretyScore.toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${
                                        surety.suretyScore > 90 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                                        surety.suretyScore > 75 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                                    }`} 
                                    style={{ width: `${surety.suretyScore}%` }} 
                                />
                            </div>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed border-t border-slate-800 pt-3">
                                {surety.auditNote}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800">
                                <Crosshair className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Best Structural Bet:</span>
                                <span className="ml-auto text-xs font-mono font-bold text-white">{surety.bestBet?.name || 'ANALYZING...'}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800">
                                <Target className="w-3 h-3 text-green-500" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Target Corridor:</span>
                                <span className="ml-auto text-xs font-mono font-bold text-white uppercase">{surety.masteryCorridor.anchor}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800">
                                <Flame className="w-3 h-3 text-red-500" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Nuclear Stress Test:</span>
                                <span className="ml-auto text-xs font-mono font-bold text-white uppercase">{surety.survivalRating.toFixed(1)}%</span>
                            </div>
                        </div>

                        {surety.isNuclearFortress && (
                            <div className="p-4 bg-yellow-500 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-pulse">
                                <div className="flex items-center gap-2 text-slate-950 mb-1">
                                    <Shield className="w-5 h-5 fill-slate-950" />
                                    <span className="font-black italic uppercase text-xs tracking-widest">NUCLEAR FORTRESS ACTIVE</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-950/80 leading-tight">
                                    ALL STRUCTURAL AND PHYSICS LAYERS HAVE CONVERGED. VERDICT LOCKED.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audit Trail Panel */}
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-slate-500" />
                        <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Forensic Audit Trail</h4>
                    </div>
                    
                    <div className="space-y-4">
                        {surety.fortressReasoning.slice(0, 4).map((reason, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5" />
                                <span className="text-[10px] font-mono text-slate-400 uppercase leading-snug">{reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
