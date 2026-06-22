
import React from 'react';
import { AnalysisResult } from '../types';
import { MedallionResult } from '../services/suretyService';
import { StatCard } from './StatCard';
import { Zap, Shield, Target, BarChart3, Activity } from 'lucide-react';
import { MatchVisualizer } from './MatchVisualizer';

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: MedallionResult;
    isOptimized?: boolean;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety, isOptimized }) => {
    const isOver15 = surety.masteryCorridor.anchor === 'OVER 1.5';
    const isUnder35 = surety.masteryCorridor.anchor === 'UNDER 3.5';
    
    // Theme mapping
    const theme = {
        name: isOver15 ? 'Emerald-Fortress' : isUnder35 ? 'Cobalt-Fortress' : 'Standard-Audit',
        accent: isOver15 ? 'emerald' : isUnder35 ? 'blue' : 'zinc',
        text: isOver15 ? 'text-emerald-500' : isUnder35 ? 'text-blue-500' : 'text-zinc-500',
        title: isOver15 ? 'text-emerald-900' : isUnder35 ? 'text-blue-900' : 'text-zinc-900',
        border: isOver15 ? 'border-emerald-900/30' : isUnder35 ? 'border-blue-900/30' : 'border-zinc-900/10',
        bg: isOver15 ? 'bg-emerald-950/20' : isUnder35 ? 'bg-blue-950/20' : 'bg-transparent',
        glow: isOver15 ? 'drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]' : isUnder35 ? 'drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]' : ''
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 focus:outline-none">
            <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard 
                        label="Success Index" 
                        value={`${analysis.probability}%`} 
                        subValue={analysis.homeStats.name}
                        icon={Zap} 
                        color={isOver15 ? 'green' : (isUnder35 ? 'blue' : 'green')}
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
                    <StatCard 
                        label="Grounding Signal" 
                        value={analysis.groundingStatus || 'OPTIMAL'} 
                        subValue={
                            analysis.groundingStatus === 'OPTIMAL' ? 'SEARCH_LIVE_GROUNDING' : 
                            analysis.groundingStatus === 'QUOTA_EXCEEDED' ? 'SEARCH_QUOTA_LIMIT' :
                            analysis.groundingStatus === 'SEARCH_COOLDOWN' ? 'COOLDOWN_ACTIVE' :
                            'INSTITUTIONAL_FALLBACK'
                        }
                        icon={Activity} 
                        color={
                            analysis.groundingStatus === 'OPTIMAL' ? 'green' : 
                            analysis.groundingStatus === 'QUOTA_EXCEEDED' ? 'red' :
                            analysis.groundingStatus === 'SEARCH_COOLDOWN' ? 'orange' :
                            'orange'
                        }
                    />
                </div>

                <div className={`bg-zinc-950 border ${theme.border} rounded-2xl p-10 space-y-10 shadow-2xl`}>
                    <div className="space-y-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b ${theme.border} pb-6 flex items-center gap-2`}>
                            <Activity className="w-3 h-3" /> Structural Integrity Visualization
                        </h3>
                        <MatchVisualizer path={analysis.regimePath} />
                    </div>

                    <div className="space-y-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b ${theme.border} pb-6 flex items-center gap-2`}>
                            <Zap className="w-3 h-3" /> Core Intelligence Summary
                        </h3>
                        <div className={`text-base ${theme.text} font-bold leading-relaxed uppercase tracking-tight opacity-90`}>
                            {isOver15 && (
                                <div className="mb-6 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                    <span className="text-emerald-400 block font-black text-2xl tracking-tighter">
                                        TARGET: OVER 1.5 (FORTRESS_SECURED)
                                    </span>
                                </div>
                            )}
                            {isUnder35 && (
                                <div className="mb-6 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <span className="text-blue-400 block font-black text-2xl tracking-tighter">
                                        TARGET: UNDER 3.5 (FORTRESS_SECURED)
                                    </span>
                                </div>
                            )}
                            <p className="leading-7 whitespace-pre-wrap font-mono text-sm opacity-80">{analysis.summary}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                {analysis.homeStats.name} Perspective
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                    <p className="text-3xl font-black text-white">{analysis.homeXG.toFixed(2)}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">Attack</span>
                                    <p className={`text-3xl font-black ${theme.text}`}>{analysis.homeStats.xT.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                        <div className={`space-y-6 md:border-l ${theme.border} md:pl-10`}>
                            <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                {analysis.awayStats.name} Perspective
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                    <p className="text-3xl font-black text-white">{analysis.awayXG.toFixed(2)}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">Attack</span>
                                    <p className={`text-3xl font-black ${theme.text}`}>{analysis.awayStats.xT.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-10">
                <div className={`${theme.bg} border ${isOver15 ? 'border-emerald-500/30' : (isUnder35 ? 'border-blue-500/30' : 'border-zinc-800')} p-12 rounded-2xl text-center space-y-8 shadow-2xl relative overflow-hidden`}>
                    <div className="relative z-10 space-y-2">
                        <span className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>Verdict</span>
                        <h2 className={`text-5xl md:text-6xl font-black italic tracking-tighter uppercase ${isOver15 ? 'text-emerald-400' : (isUnder35 ? 'text-blue-400' : 'text-zinc-100')} ${theme.glow}`}>
                            {surety.bestBet?.name || surety.verdict}
                        </h2>
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className={`flex justify-between items-center ${theme.title} border-b ${theme.border} pb-2`}>
                            <span className="text-[10px] font-black uppercase">Surety</span>
                            <span className={`text-xl font-black ${theme.text}`}>{surety.suretyScore.toFixed(0)}%</span>
                        </div>
                        <p className={`text-[9px] ${theme.text} opacity-60 font-bold uppercase leading-relaxed text-left`}>
                            {surety.auditNote}
                        </p>
                    </div>

                    <div className="relative z-10 space-y-2">
                        <div className={`flex items-center justify-between p-4 bg-black/40 border ${theme.border} rounded-lg`}>
                            <span className={`text-[9px] uppercase font-black opacity-40`}>Target</span>
                            <span className={`text-[10px] font-black ${theme.text}`}>{surety.bestBet?.name || '---'}</span>
                        </div>
                    </div>
                </div>

                <div className={`space-y-6 p-6 bg-zinc-950 border ${theme.border} rounded-2xl shadow-2xl`}>
                    <h4 className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>
                        Risk Matrix
                    </h4>
                    <div className="space-y-3">
                        {surety.fortressReasoning.slice(0, 3).map((reason, i) => (
                            <div key={i} className="flex gap-2 text-[9px] font-bold uppercase opacity-60">
                                <span>{`//`}</span>
                                <p>{reason}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`space-y-6 p-6 bg-zinc-950 border ${theme.border} rounded-2xl shadow-2xl`}>
                    <h4 className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>
                        Environment
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black opacity-30">Weather</span>
                            <p className={`text-[9px] font-bold ${theme.text} uppercase`}>{analysis.context.weather || '---'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black opacity-30">Referee</span>
                            <p className={`text-[9px] font-bold ${theme.text} uppercase`}>{analysis.context.referee || '---'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
