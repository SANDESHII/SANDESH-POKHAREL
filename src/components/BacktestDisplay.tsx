
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, CheckCircle2, XCircle, BarChart3, Play } from 'lucide-react';
import { BacktestSummary } from '../services/backtestService';
import { fetchWithTimeout } from '../lib/fetchUtils';

export const BacktestDisplay: React.FC = () => {
    const [summary, setSummary] = useState<BacktestSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const runBacktest = async () => {
        setLoading(true);
        try {
            const res = await fetchWithTimeout('/api/backtest', {}, 120000); // 120s for long backtests
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
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">System Accuracy</h3>
                    <p className="text-2xl font-black text-white uppercase tracking-tighter">Model Backtest</p>
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
                            { label: 'Overall Brier', value: summary.brierScore.toFixed(4), icon: BarChart3, detail: 'Across all inputs' },
                            { label: 'High-Purity Brier', value: summary.highPurityBrierScore.toFixed(4), icon: CheckCircle2, detail: `N=${summary.highPurityMatches} (Real Data Only)` },
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
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Market Edge Analysis (O2.5 Lines)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {summary.edgeSegments.map((seg, i) => (
                                    <div key={i} className="space-y-4 p-5 bg-zinc-900/30 rounded-xl border border-zinc-900 transition-all hover:bg-zinc-900/50">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[9px] font-black text-white uppercase tracking-widest">{seg.segment}</span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${seg.hitRate > 0.5 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                                Hit Rate: {(seg.hitRate * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">
                                                <span>Sample Size</span>
                                                <span>{seg.count} Matches</span>
                                            </div>
                                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-zinc-500 transition-all duration-1000" 
                                                    style={{ width: `${(seg.count / summary.totalMatches) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                                            <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">Avg Edge</span>
                                            <span className="text-sm font-black text-white">+{(seg.avgEdge * 100).toFixed(2)} pts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

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
                                        <th className="px-6 py-4 text-[8px] font-black uppercase text-zinc-500 tracking-widest text-center">Edge</th>
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-black text-white uppercase tracking-tight">{item.match.homeTeam} vs {item.match.awayTeam}</span>
                                                            {item.prediction.purity >= 80 ? (
                                                                <span className="text-[6px] px-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded font-black">HIGH PURITY</span>
                                                            ) : (
                                                                <span className="text-[6px] px-1 bg-zinc-900 text-zinc-600 border border-zinc-800 rounded font-black uppercase">Synthetic</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-zinc-600 font-bold uppercase">{item.match.league}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-bold text-zinc-400 font-mono">
                                                        {item.match.actualScore[0]} - {item.match.actualScore[1]}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {item.marketEdge !== undefined ? (
                                                        <span className={`text-[10px] font-bold ${item.marketEdge > 0.05 ? 'text-emerald-500' : item.marketEdge > 0.02 ? 'text-emerald-400/70' : 'text-zinc-600'}`}>
                                                            {item.marketEdge > 0 ? '+' : ''}{(item.marketEdge * 100).toFixed(1)} pts
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-800">—</span>
                                                    )}
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
