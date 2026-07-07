
import React from 'react';
import { AnalysisResult, AnalysisConfidence } from '../types';
import { Zap, Shield, Target, Activity, TrendingUp, Crown, Link, Users, BookOpen, Search } from 'lucide-react';
import { StatCard } from './results/StatCard';
import { MatchVisualizer } from './results/MatchVisualizer';
import { VerifiedPrediction } from './results/VerifiedPrediction';

import { ProtocolStatusBox } from './results/ProtocolStatusBox';

interface ResultGridProps {
    analysis: AnalysisResult;
    surety: AnalysisConfidence;
}

export const ResultGrid: React.FC<ResultGridProps> = ({ analysis, surety }) => {
    const pType = analysis.predictionType;
    
    const getThemeConfig = () => {
        if (analysis.predictionType === 'OVER_15') {
            return { 
                accent: 'blue', 
                text: 'text-blue-400', 
                title: 'text-blue-300', 
                border: 'border-blue-500/50', 
                bg: 'bg-blue-950/40', 
                glow: 'drop-shadow-[0_0_25px_rgba(59,130,246,0.5)]',
                container: 'bg-blue-950/10 border-blue-500/20'
            };
        }
        if (analysis.isSureshot || analysis.lockCount === 4) {
            return { 
                accent: 'cyan', 
                text: 'text-cyan-400', 
                title: 'text-cyan-900', 
                border: 'border-cyan-500/50', 
                bg: 'bg-cyan-950/40', 
                glow: 'drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]',
                container: 'bg-transparent border-transparent'
            };
        }
        return { 
            accent: 'zinc', 
            text: 'text-zinc-500', 
            title: 'text-zinc-500', 
            border: 'border-zinc-800', 
            bg: 'bg-transparent', 
            glow: '',
            container: 'bg-transparent border-transparent'
        };
    };

    const theme = getThemeConfig();
    const isHighIntensity = pType === 'OVER_15';
    const isOverMode = pType === 'OVER_15';

    return (
        <div className={`space-y-10 focus:outline-none p-8 rounded-3xl border transition-all duration-700 ${theme.container}`}>
            {isOverMode && (
                <div className="flex items-center gap-3 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full w-fit mb-4">
                    <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Over 1.5 Signal Detected</span>
                </div>
            )}
            <ProtocolStatusBox analysis={analysis} />
            
            <VerifiedPrediction analysis={analysis} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard 
                            label="Probability" 
                            value={`${analysis.probability}%`} 
                            subValue="SIGNAL"
                            icon={Zap} 
                            isOver={isHighIntensity}
                        />
                        <StatCard 
                            label="Prediction" 
                            value={analysis.prediction?.replace(' GOALS', '') || "STABLE"} 
                            subValue="ALGORITHM"
                            icon={Target} 
                            isOver={isHighIntensity}
                        />
                        <StatCard 
                            label="Min Goals" 
                            value={analysis.minimumExpectancy?.toFixed(2) || '0.00'} 
                            subValue="EXPECTANCY"
                            icon={Shield} 
                            isOver={isHighIntensity}
                        />
                        <StatCard 
                            label="Max Goals" 
                            value={analysis.potentialCeiling?.toFixed(2) || '0.00'} 
                            subValue="UPPER LIMIT"
                            icon={TrendingUp} 
                            isOver={isHighIntensity}
                        />
                    </div>
 
                    <div className={`bg-zinc-950 border ${theme.border} rounded-2xl p-10 space-y-12 shadow-2xl`}>
                        <div className="space-y-6">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} border-b border-zinc-900 pb-6 flex items-center gap-2`}>
                                <Activity className="w-3 h-3" /> Tactical Projection
                            </h3>
                            <MatchVisualizer path={analysis.tacticalPath} isOver={isOverMode} />
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
                    <div className={`${theme.bg} border ${theme.border} p-10 rounded-2xl text-center space-y-8 shadow-2xl relative overflow-hidden`}>
                        <div className="absolute top-4 right-4 flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (analysis.lockCount || 0) ? theme.text.replace('text-', 'bg-') : 'bg-zinc-800'}`} />
                            ))}
                        </div>
                        <div className="relative z-10 space-y-2">
                            <span className={`text-[10px] uppercase font-black tracking-widest ${theme.title}`}>Statistical Surety</span>
                            <h2 className={`text-5xl md:text-6xl font-black italic tracking-tighter uppercase ${theme.text} ${theme.glow}`}>
                                {analysis.isSureshot ? 'SURESHOT' : surety.verdict}
                            </h2>
                            <div className="flex justify-center gap-4 mt-4">
                                <div className="flex items-center gap-1.5">
                                    {analysis.isSureshot ? (
                                        <Crown className={`w-4 h-4 ${theme.text} animate-pulse`} />
                                    ) : (
                                        <Shield className={`w-3 h-3 ${analysis.lockCount >= 3 ? theme.text : 'text-zinc-800'}`} />
                                    )}
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${analysis.lockCount >= 3 || analysis.isSureshot ? 'text-zinc-300' : 'text-zinc-800'}`}>
                                        {analysis.isSureshot ? 'ABSOLUTE ZERO PROTOCOL' : 'Nuclear Fortress'}
                                    </span>
                                </div>
                            </div>
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

            {(analysis.realTimeData || analysis.sources) && (
                <div className="pt-10 border-t border-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-10">
                    {analysis.realTimeData && (
                        <div className="space-y-8">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} flex items-center gap-2`}>
                                <Users className="w-3 h-3" /> Real-Time Intelligence
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest block">Home Rotation</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {analysis.realTimeData.homeLineup?.map((p, i) => (
                                            <span key={i} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-300 font-bold uppercase rounded">{p}</span>
                                        )) || <span className="text-zinc-600 text-[10px] italic">No data found</span>}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest block">Away Rotation</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {analysis.realTimeData.awayLineup?.map((p, i) => (
                                            <span key={i} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-300 font-bold uppercase rounded">{p}</span>
                                        )) || <span className="text-zinc-600 text-[10px] italic">No data found</span>}
                                    </div>
                                </div>
                            </div>
                            {analysis.realTimeData.tacticalShift && (
                                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-3 h-3 text-zinc-500" />
                                        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Tactical News</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-300 leading-relaxed font-medium italic">"{analysis.realTimeData.tacticalShift}"</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {analysis.sources && (
                        <div className="space-y-8">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.title} flex items-center gap-2`}>
                                <Search className="w-3 h-3" /> Grounding Sources
                            </h3>
                            <div className="space-y-3">
                                {analysis.sources.map((src, i) => (
                                    <a 
                                        key={i} 
                                        href={src} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 rounded-lg hover:border-zinc-700 transition-colors group"
                                    >
                                        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[80%]">{src}</span>
                                        <Link className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

