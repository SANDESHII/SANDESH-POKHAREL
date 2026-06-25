
import React from 'react';
import { AnalysisResult, TacticalPhase, AnalysisConfidence } from '../types';
import { Zap, Shield, Target, BarChart3, Activity, TrendingUp, Search, AlertCircle, Terminal, Database } from 'lucide-react';
import { motion } from 'motion/react';

// --- SUB-COMPONENTS ---

const StatCard: React.FC<{ label: string, value: string | number, subValue?: string, icon: any, color: string }> = ({ label, value, subValue, icon: Icon, color }) => (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
            <Icon className={`w-4 h-4 text-${color}-500`} />
        </div>
        <div className="space-y-1">
            <h4 className="text-3xl font-black text-white">{value}</h4>
            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest">{subValue}</p>
        </div>
    </div>
);

const MatchVisualizer: React.FC<{ path: TacticalPhase[] }> = ({ path }) => {
    const getStateColor = (state: string) => {
        switch (state) {
            case 'HIGH_VARIANCE': return 'from-rose-600 to-orange-500';
            case 'TRANSITIONAL': return 'from-emerald-600 to-teal-500';
            case 'DOMINANT': return 'from-emerald-400 to-emerald-600';
            default: return 'from-emerald-950 to-emerald-900';
        }
    };

    return (
        <div className="space-y-6 bg-emerald-950/20 p-6 rounded-2xl border border-emerald-900/30">
            <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-[0.2em] text-emerald-900">
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
                            <div className="bg-zinc-950 border border-emerald-900/50 p-3 rounded-xl shadow-2xl whitespace-nowrap">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 pb-1 border-b border-emerald-900/20">{step.state.replace(/_/g, ' ')}</p>
                                <div className="flex items-center justify-between gap-6">
                                    <span className="text-[10px] text-emerald-900 font-bold uppercase">Energy: <span className="text-white">{step.intensity?.toFixed(1) || '0.0'}</span></span>
                                    <span className="text-[10px] text-emerald-900 font-bold uppercase">Surety: <span className="text-emerald-500">{((step.confidence || 0) * 100).toFixed(0)}%</span></span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.3em] font-black text-emerald-950 pt-2 text-center">
                <span>00:00</span><span>30:00</span><span>60:00</span><span>90:00</span>
            </div>
        </div>
    );
};

// --- MAIN COMPONENTS ---

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: AnalysisConfidence;
    isOptimized?: boolean;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety, isOptimized }) => {
    const isOver15 = analysis.predictionType === 'OVER' || analysis.predictionType === 'BTTS';
    const isUnder35 = analysis.predictionType === 'UNDER' || analysis.predictionType === 'STABILITY';
    
    // Theme mapping
    const theme = {
        name: isOver15 ? 'Growth-Theme' : isUnder35 ? 'Stability-Theme' : 'Standard-Theme',
        accent: isOver15 ? 'emerald' : isUnder35 ? 'blue' : 'zinc',
        text: isOver15 ? 'text-emerald-400' : isUnder35 ? 'text-blue-400' : 'text-zinc-500',
        title: isOver15 ? 'text-emerald-900' : isUnder35 ? 'text-blue-900' : 'text-zinc-500',
        border: isOver15 ? 'border-emerald-900/30' : isUnder35 ? 'border-blue-900/30' : 'border-zinc-800',
        bg: isOver15 ? 'bg-emerald-950/20' : isUnder35 ? 'bg-blue-950/20' : 'bg-transparent',
        glow: isOver15 ? 'drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]' : (isUnder35 ? 'drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]' : '')
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 focus:outline-none">
            <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard 
                        label="Projected Probability" 
                        value={`${analysis.probability}%`} 
                        subValue="SIGNAL_STRENGTH"
                        icon={Zap} 
                        color={isOver15 ? 'green' : (isUnder35 ? 'blue' : 'zinc')}
                    />
                    <StatCard 
                        label="Prediction Status" 
                        value={isOver15 ? "OVER 1.5" : (isUnder35 ? "UNDER 3.5" : "NEUTRAL")} 
                        subValue="ALGORITHMIC_TARGET"
                        icon={Target} 
                        color={isOver15 ? "green" : (isUnder35 ? "blue" : "zinc")}
                    />
                    <StatCard 
                        label="Baseline Expectancy" 
                        value={analysis.minimumExpectancy?.toFixed(2) || '0.00'} 
                        subValue="GOALS"
                        icon={Shield} 
                        color="blue"
                    />
                    <StatCard 
                        label="Potential Limit" 
                        value={analysis.potentialCeiling?.toFixed(2) || '0.00'} 
                        subValue="LIMIT"
                        icon={Target} 
                        color="purple"
                    />
                </div>

                <div className={`bg-zinc-950 border ${theme.border} rounded-2xl p-10 space-y-10 shadow-2xl`}>
                    <div className="space-y-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b ${theme.border} pb-6 flex items-center gap-2`}>
                            <Activity className="w-3 h-3" /> Tactical Energy Projection
                        </h3>
                        <MatchVisualizer path={analysis.tacticalPath} />
                    </div>

                    <div className="space-y-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b ${theme.border} pb-6 flex items-center gap-2`}>
                            <Zap className="w-3 h-3" /> Performance Summary
                        </h3>
                        <div className={`text-base ${theme.text} font-bold leading-relaxed uppercase tracking-tight opacity-90`}>
                            {analysis.prediction && (
                                <div className={`mb-6 p-6 ${isOver15 ? 'bg-emerald-500/10 border-emerald-500/30' : (isUnder35 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-500/10 border-zinc-500/30')} border rounded-xl`}>
                                    <span className={`${isOver15 ? 'text-emerald-400' : (isUnder35 ? 'text-blue-400' : 'text-zinc-400')} block font-black text-2xl tracking-tighter uppercase`}>
                                        Targeted Prediction: {analysis.prediction}
                                    </span>
                                </div>
                            )}
                            <p className="leading-7 whitespace-pre-wrap font-mono text-sm opacity-80">{analysis.summary}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                {analysis.homeStats.name} Analysis
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                    <p className="text-3xl font-black text-white">{analysis.homeXG?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">Attack</span>
                                    <p className={`text-3xl font-black ${theme.text}`}>{analysis.homeStats.xT?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>
                        </div>
                        <div className={`space-y-6 md:border-l ${theme.border} md:pl-10`}>
                            <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                {analysis.awayStats.name} Analysis
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                    <p className="text-3xl font-black text-white">{analysis.awayXG?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] text-zinc-600 uppercase font-black">Attack</span>
                                    <p className={`text-3xl font-black ${theme.text}`}>{analysis.awayStats.xT?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 border-t border-zinc-900 space-y-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} flex items-center gap-2`}>
                            <BarChart3 className="w-3 h-3" /> Performance Metrics
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl space-y-1">
                                <span className="text-[8px] text-zinc-500 uppercase font-black">Form Impact</span>
                                <div className="flex justify-between items-end">
                                    <p className="text-sm font-bold text-white">{(analysis.homeStats.calibrationStability || 0.8 * 100).toFixed(0)}%</p>
                                    <p className="text-[10px] font-bold text-zinc-600">{(analysis.awayStats.calibrationStability || 0.8 * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-10">
                <div className={`${theme.bg} border ${isOver15 ? 'border-emerald-500/30' : (isUnder35 ? 'border-blue-500/30' : 'border-zinc-800')} p-12 rounded-2xl text-center space-y-8 shadow-2xl relative overflow-hidden`}>
                    <div className="relative z-10 space-y-2">
                        <span className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>Confidence Level</span>
                        <h2 className={`text-5xl md:text-6xl font-black italic tracking-tighter uppercase ${isOver15 ? 'text-emerald-400' : (isUnder35 ? 'text-blue-400' : 'text-zinc-100')} ${theme.glow}`}>
                            {surety.verdict}
                        </h2>
                    </div>

                    <div className="relative z-10 space-y-4">
                        <div className={`flex justify-between items-center ${theme.title} border-b ${theme.border} pb-2`}>
                            <span className="text-[10px] font-black uppercase">Confidence Score</span>
                            <span className={`text-xl font-black ${theme.text}`}>{surety.confidenceScore?.toFixed(0) || '0'}%</span>
                        </div>
                        <p className={`text-[9px] ${theme.text} opacity-60 font-bold uppercase leading-relaxed text-left`}>
                            {analysis.summary.slice(0, 150)}...
                        </p>
                    </div>

                    <div className="relative z-10 space-y-2">
                        <div className={`flex items-center justify-between p-4 bg-black/40 border ${theme.border} rounded-lg`}>
                            <span className={`text-[9px] uppercase font-black opacity-40`}>Recommendation</span>
                            <span className={`text-[10px] font-black ${theme.text}`}>{surety.bestBet?.name || '---'}</span>
                        </div>
                    </div>
                </div>

                {/* Market Indicators */}
                <div className={`space-y-6 p-6 bg-zinc-950 border ${theme.border} rounded-2xl shadow-2xl`}>
                    <h4 className={`text-[10px] uppercase font-black tracking-widest ${theme.title} flex items-center gap-2`}>
                        <TrendingUp className="w-3 h-3" /> Market Indicators
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black opacity-30 block">Volume</span>
                            <div className="text-[10px] font-mono text-zinc-300 uppercase">{analysis.marketIndicators.volume}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black opacity-30 block">Sentiment</span>
                            <div className="text-[10px] font-mono text-zinc-300 uppercase">{(analysis.marketIndicators.sentimentScore * 100).toFixed(0)}</div>
                        </div>
                    </div>
                </div>

                <div className={`space-y-6 p-6 bg-zinc-950 border ${theme.border} rounded-2xl shadow-2xl`}>
                    <h4 className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>
                        Analysis Reasoning
                    </h4>
                    <div className="space-y-3">
                        {surety.analysisReasoning.slice(0, 3).map((reason, i) => (
                            <div key={i} className="flex gap-2 text-[9px] font-bold uppercase opacity-60">
                                <span>{`//`}</span>
                                <p>{reason}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
