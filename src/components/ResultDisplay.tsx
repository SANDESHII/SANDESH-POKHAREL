
import React from 'react';
import { AnalysisResult, AnalysisConfidence } from '../types';
import { Zap, Shield, Target, Activity, TrendingUp } from 'lucide-react';
import { StatCard } from './results/StatCard';
import { MatchVisualizer } from './results/MatchVisualizer';
import { VerifiedPrediction } from './results/VerifiedPrediction';

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: AnalysisConfidence;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety }) => {
    const isOver15 = analysis.prediction?.includes('OVER 1.5');
    const isUnder35 = analysis.prediction?.includes('UNDER 3.5');
    const hasSignal = analysis.probability >= 70;
    
    const theme = {
        accent: hasSignal ? (isOver15 ? 'emerald' : isUnder35 ? 'blue' : 'zinc') : 'zinc',
        text: hasSignal ? (isOver15 ? 'text-emerald-400' : isUnder35 ? 'text-blue-400' : 'text-zinc-500') : 'text-zinc-500',
        title: hasSignal ? (isOver15 ? 'text-emerald-900' : isUnder35 ? 'text-blue-900' : 'text-zinc-500') : 'text-zinc-500',
        border: hasSignal ? (isOver15 ? 'border-emerald-900/30' : isUnder35 ? 'border-blue-900/30' : 'border-zinc-800') : 'border-zinc-800',
        bg: hasSignal ? (isOver15 ? 'bg-emerald-950/20' : isUnder35 ? 'bg-blue-950/20' : 'bg-transparent') : 'bg-transparent',
        glow: hasSignal ? (isOver15 ? 'drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]' : (isUnder35 ? 'drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]' : '')) : ''
    };

    return (
        <div className="space-y-10 focus:outline-none">
            <VerifiedPrediction analysis={analysis} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard 
                            label="Probability" 
                            value={`${analysis.probability}%`} 
                            subValue="SIGNAL"
                            icon={Zap} 
                            isOver={isOver15}
                        />
                        <StatCard 
                            label="Target" 
                            value={analysis.prediction?.replace(' GOALS', '') || (isOver15 ? "OVER 1.5" : "UNDER 3.5")} 
                            subValue="ALGORITHM"
                            icon={Target} 
                            isOver={isOver15}
                        />
                        <StatCard 
                            label="Baseline" 
                            value={analysis.minimumExpectancy?.toFixed(2) || '0.00'} 
                            subValue="GOALS"
                            icon={Shield} 
                            isOver={isOver15}
                        />
                        <StatCard 
                            label="Potential" 
                            value={analysis.potentialCeiling?.toFixed(2) || '0.00'} 
                            subValue="LIMIT"
                            icon={Target} 
                            isOver={isOver15}
                        />
                    </div>

                    <div className={`bg-zinc-950 border ${theme.border} rounded-2xl p-10 space-y-12 shadow-2xl`}>
                        <div className="space-y-6">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b border-zinc-900 pb-6 flex items-center gap-2`}>
                                <Activity className="w-3 h-3" /> Tactical Projection
                            </h3>
                            <MatchVisualizer path={analysis.tacticalPath} isOver={isOver15} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-zinc-900">
                            <div className="space-y-6">
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                    {analysis.homeStats.name}
                                </h4>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                        <p className="text-3xl font-black text-white">{analysis.homeXG?.toFixed(2) || '0.00'}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-zinc-600 uppercase font-black">Power</span>
                                        <p className={`text-3xl font-black ${theme.text}`}>{analysis.homeStats.xT?.toFixed(2) || '0.00'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={`space-y-6 md:border-l border-zinc-900 md:pl-10`}>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                                    {analysis.awayStats.name}
                                </h4>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-zinc-600 uppercase font-black">xG</span>
                                        <p className="text-3xl font-black text-white">{analysis.awayXG?.toFixed(2) || '0.00'}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-zinc-600 uppercase font-black">Power</span>
                                        <p className={`text-3xl font-black ${theme.text}`}>{analysis.awayStats.xT?.toFixed(2) || '0.00'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className={`${theme.bg} border ${isOver15 ? 'border-emerald-500/30' : (isUnder35 ? 'border-blue-500/30' : 'border-zinc-800')} p-10 rounded-2xl text-center space-y-8 shadow-2xl relative overflow-hidden`}>
                        <div className="relative z-10 space-y-2">
                            <span className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>Statistical Surety</span>
                            <h2 className={`text-5xl md:text-6xl font-black italic tracking-tighter uppercase ${isOver15 ? 'text-emerald-400' : (isUnder35 ? 'text-blue-400' : 'text-zinc-100')} ${theme.glow}`}>
                                {surety.verdict}
                            </h2>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className={`flex justify-between items-center ${theme.title} border-b border-zinc-900/50 pb-2`}>
                                <span className="text-[10px] font-black uppercase tracking-widest">Confidence</span>
                                <span className={`text-xl font-black ${theme.text}`}>{surety.confidenceScore?.toFixed(0) || '0'}%</span>
                            </div>
                            <p className={`text-[10px] ${theme.text} opacity-60 font-black uppercase leading-relaxed text-left font-mono`}>
                                {analysis.summary.slice(0, 120)}...
                            </p>
                        </div>
                    </div>

                    <div className={`space-y-6 p-6 bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl`}>
                        <h4 className={`text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2`}>
                            <TrendingUp className="w-3 h-3" /> Indicators
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[8px] uppercase font-black opacity-30 block">Entropy</span>
                                <div className="text-[10px] font-mono text-zinc-300 uppercase">{analysis.marketIndicators.volume}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] uppercase font-black opacity-30 block">Sentiment</span>
                                <div className="text-[10px] font-mono text-zinc-300 uppercase">{(analysis.marketIndicators.sentimentScore * 100).toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>

                    <div className={`space-y-6 p-6 bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl`}>
                        <h4 className={`text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2`}>
                            <Zap className="w-3 h-3 text-amber-500" /> Signal Audit
                        </h4>
                        <div className="space-y-4">
                            <div className="space-y-2 p-3 bg-black/40 border border-zinc-900 rounded-lg">
                                <span className="text-[8px] uppercase font-black opacity-30 block">Market</span>
                                <p className="text-[10px] font-bold text-zinc-100 uppercase leading-relaxed">{analysis.context.marketSentiment || "STEADY"}</p>
                            </div>
                            <div className="space-y-2 p-3 bg-black/40 border border-zinc-900 rounded-lg">
                                <span className="text-[8px] uppercase font-black opacity-30 block">Drift</span>
                                <p className="text-[10px] font-bold text-zinc-100 uppercase leading-relaxed">{analysis.context.tacticalDrift || "STABLE"}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

