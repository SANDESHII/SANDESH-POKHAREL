
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, CheckCircle2, XCircle, BarChart3, Play } from 'lucide-react';
import { BacktestSummary } from '../services/backtestService';

export const BacktestDisplay: React.FC = () => {
    const [summary, setSummary] = useState<BacktestSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const runBacktest = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/backtest');
            const data = await res.json();
            setSummary(data);
            setShowResults(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Validation Protocol</h3>
                    <p className="text-2xl font-black text-white uppercase tracking-tighter">System Backtest</p>
                </div>
                <button 
                    onClick={runBacktest}
                    disabled={loading}
                    className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group"
                >
                    {loading ? (
                        <Activity className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    )}
                    {loading ? 'SIMULATING...' : 'RUN BACKTEST'}
                </button>
            </div>

            <AnimatePresence>
                {showResults && summary && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-4 gap-6"
                    >
                        {[
                            { label: 'Samples Analyzed', value: summary.totalMatches, icon: Activity },
                            { label: 'Brier Score', value: summary.brierScore.toFixed(4), icon: BarChart3, detail: 'Lower is better' },
                            { label: 'Avg. Confidence', value: `${summary.averageConfidence.toFixed(1)}%`, icon: BarChart3 },
                            { label: 'Signal Accuracy', value: `${((summary.over15Accuracy + summary.under35Accuracy) / 2).toFixed(1)}%`, icon: CheckCircle2 }
                        ].map((stat, i) => (
                            <div key={i} className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl space-y-4">
                                <stat.icon className="w-5 h-5 text-emerald-500" />
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest block">{stat.label}</span>
                                    <p className="text-3xl font-black text-white">{stat.value}</p>
                                    {stat.detail && <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-tight">{stat.detail}</span>}
                                </div>
                            </div>
                        ))}

                        <div className="md:col-span-4 p-6 bg-zinc-950 border border-zinc-900 rounded-2xl">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Reliability Calibration</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {summary.calibrationBins.map((bin, i) => (
                                    <div key={i} className="space-y-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-900">
                                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{bin.bin}</span>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-lg font-black text-white">{(bin.hitRate * 100).toFixed(0)}%</span>
                                            <span className="text-[8px] text-zinc-600 font-bold">N={bin.n}</span>
                                        </div>
                                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500/50 transition-all duration-1000" 
                                                style={{ width: `${bin.hitRate * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[7px] text-zinc-700 font-bold uppercase tracking-tighter block">Expected: {(bin.expected * 100).toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-4 overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-900/50">
                                    <tr>
                                        <th className="px-6 py-4 text-[8px] font-black uppercase text-zinc-500 tracking-widest">Match-Up</th>
                                        <th className="px-6 py-4 text-[8px] font-black uppercase text-zinc-500 tracking-widest text-center">Score</th>
                                        <th className="px-6 py-4 text-[8px] font-black uppercase text-zinc-500 tracking-widest">Signal</th>
                                        <th className="px-6 py-4 text-[8px] font-black uppercase text-zinc-500 tracking-widest text-right">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900">
                                    {summary.matches.map((item, i) => {
                                        const predType = item.prediction.predictionType || 'VOID';
                                        const isCorrect = predType === 'OVER_15' ? item.isOver15Correct : item.isUnder35Correct;
                                        return (
                                            <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-white uppercase tracking-tight">{item.match.homeTeam} vs {item.match.awayTeam}</span>
                                                        <span className="text-[9px] text-zinc-600 font-bold uppercase">{item.match.league}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold text-zinc-400 font-mono">
                                                        {item.match.actualScore[0]} - {item.match.actualScore[1]}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${predType === 'OVER_15' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                                            {predType.replace('_', ' ')}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-600">@{item.prediction.probability}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {isCorrect ? 'HIT' : 'MISS'}
                                                        </span>
                                                        {isCorrect ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
