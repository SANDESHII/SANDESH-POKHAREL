
import React from 'react';
import { Terminal, Database } from 'lucide-react';
import { AnalysisResult } from '../types';

interface LogPanelProps {
    analysis: AnalysisResult | null;
}

export const LogPanel: React.FC<LogPanelProps> = ({ analysis }) => {
    return (
        <div className="bg-zinc-950 p-8 rounded-2xl border border-emerald-900/30 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-4 mb-8 border-b border-emerald-900/20 pb-6">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-950" />
                    <div className="w-3 h-3 rounded-full bg-emerald-900" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-zinc-500" />
                    <span className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 font-mono">Stream Intelligence Archive</span>
                </div>
                <div className="ml-auto text-[10px] font-black text-zinc-700 font-mono">
                    UTC: {new Date().toISOString().replace('T', ' ').slice(0, 19)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 font-mono overflow-x-auto">
                <div className="space-y-4">
                    <h5 className="text-[10px] text-emerald-500 font-black uppercase border-l-4 border-emerald-500 pl-3">Ingestion</h5>
                    <div className="space-y-2">
                        <p className="text-[11px] text-zinc-500 font-bold">PROVIDER: <span className="text-white">OPTA/FBREF</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">BIAS (U): <span className="text-white">{analysis?.calibration?.understatBias?.toFixed(2) || '1.00'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">BIAS (S): <span className="text-white">{analysis?.calibration?.sofaScoreBias?.toFixed(2) || '1.00'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">CERTAINTY: <span className="text-white">{(analysis?.calibration?.calibrationConfidence || 0.8 * 100).toFixed(0)}%</span></p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h5 className="text-[10px] text-emerald-500 font-black uppercase border-l-4 border-emerald-500 pl-3">Market</h5>
                    <div className="space-y-2">
                        <p className="text-[11px] text-zinc-500 font-bold">SYNDICATE: <span className="text-white">{analysis?.marketReality?.syndicateFlow || 'NEUTRAL'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">DIVERGENCE: <span className="text-white">{analysis?.marketReality?.marketDivergence?.toFixed(2) || '0.00'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">MOVEMENT: <span className="text-white">{analysis?.marketReality?.marketMovementSignal?.toFixed(2) || '0.00'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">SENTIMENT: <span className="text-white">{analysis?.marketReality?.sentimentScore?.toFixed(2) || '0.50'}</span></p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h5 className="text-[10px] text-emerald-500 font-black uppercase border-l-4 border-emerald-500 pl-3">Audits</h5>
                    <div className="space-y-2">
                        <p className="text-[11px] text-zinc-500 font-bold">INTEGRITY: <span className="text-white">{analysis?.modelAudit?.forensicIntegrity?.toFixed(2) || '---'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">MOMENTUM: <span className="text-white">{analysis?.modelAudit?.recursiveFilterMomentum?.toFixed(2) || '---'}</span></p>
                        <p className="text-[11px] text-zinc-500 font-bold">NOISE_RATIO: <span className="text-white">{analysis?.modelAudit?.noiseRatio?.toFixed(2) || '---'}</span></p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h5 className="text-[10px] text-emerald-500 font-black uppercase border-l-4 border-emerald-500 pl-3">Risk Assessment</h5>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                        {analysis?.prosecution?.contradictions.map((c, i) => (
                            <p key={i} className="text-[9px] text-emerald-500 leading-tight mb-2 font-bold opacity-60">
                                {`> [SIGNAL_${i}] ${c}`}
                            </p>
                        )) || (
                            <p className="text-[9px] text-zinc-700 italic leading-tight uppercase font-black opacity-40">
                                {`> NO ANOMALIES DETECTED IN PRIMARY STREAM.`}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {analysis?.sources && analysis.sources.length > 0 && (
                <div className="mt-8 pt-6 border-t border-emerald-900/20 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Database className="w-3 h-3 text-zinc-500" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Knowledge Base:</span>
                    </div>
                    {analysis.sources.map((source, i) => (
                        <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase underline underline-offset-4 decoration-emerald-900/50"
                        >
                            [{source.title.slice(0, 15)}]
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};
