
import React from 'react';
import { Terminal, Database } from 'lucide-react';
import { AnalysisResult } from '../types';

interface LogPanelProps {
    analysis: AnalysisResult | null;
}

export const LogPanel: React.FC<LogPanelProps> = ({ analysis }) => {
    return (
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-6 border-b border-slate-800/50 pb-4">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500 font-mono italic">Raw Stream Metadata</span>
                </div>
                <div className="ml-auto text-[10px] font-mono text-slate-600">
                    UTC: {new Date().toISOString().replace('T', ' ').slice(0, 19)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono overflow-x-auto">
                <div className="space-y-3">
                    <h5 className="text-[10px] text-blue-500 font-bold uppercase border-l-2 border-blue-500/50 pl-2">Ingestion Layer</h5>
                    <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400">PROVIDER: <span className="text-white">OPTA/FBREF</span></p>
                        <p className="text-[11px] text-slate-400">BIAS (U): <span className="text-white">{analysis?.calibration?.understatBias.toFixed(2) || '1.00'}</span></p>
                        <p className="text-[11px] text-slate-400">BIAS (S): <span className="text-white">{analysis?.calibration?.sofaScoreBias.toFixed(2) || '1.00'}</span></p>
                        <p className="text-[11px] text-slate-400">CERTAINTY: <span className="text-white">{(analysis?.calibration?.calibrationConfidence || 0.8 * 100).toFixed(0)}%</span></p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h5 className="text-[10px] text-purple-500 font-bold uppercase border-l-2 border-purple-500/50 pl-2">Market Reality</h5>
                    <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400">SYNDICATE: <span className="text-white">{analysis?.marketReality?.syndicateFlow || 'NEUTRAL'}</span></p>
                        <p className="text-[11px] text-slate-400">DIVERGENCE: <span className="text-white">{analysis?.marketReality?.marketDivergence.toFixed(2) || '0.00'}</span></p>
                        <p className="text-[11px] text-slate-400">SIGNAL_MVMT: <span className="text-white">{analysis?.marketReality?.marketMovementSignal.toFixed(2) || '0.00'}</span></p>
                        <p className="text-[11px] text-slate-400">SENTIMENT: <span className="text-white">{analysis?.marketReality?.sentimentScore.toFixed(2) || '0.50'}</span></p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h5 className="text-[10px] text-green-500 font-bold uppercase border-l-2 border-green-500/50 pl-2">Model Audits</h5>
                    <div className="space-y-1.5">
                        <p className="text-[11px] text-slate-400">BAYES_POISSON: <span className="text-white">{analysis?.modelAudit?.bayesianPoisson.toFixed(2) || '---'}</span></p>
                        <p className="text-[11px] text-slate-400">GRADIENT_BOOST: <span className="text-white">{analysis?.modelAudit?.gradientBoosting.toFixed(2) || '---'}</span></p>
                        <p className="text-[11px] text-slate-400">SHANNON_ENTROPY: <span className="text-white">{analysis?.modelAudit?.entropy.toFixed(2) || '---'}</span></p>
                        <p className="text-[11px] text-slate-400">EVT_RISK: <span className="text-white">{analysis?.modelAudit?.evtRisk.toFixed(2) || '---'}</span></p>
                    </div>
                </div>

                <div className="space-y-3">
                    <h5 className="text-[10px] text-orange-500 font-bold uppercase border-l-2 border-orange-500/50 pl-2">Prosecution Case</h5>
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar pr-2">
                        {analysis?.prosecution?.contradictions.map((c, i) => (
                            <p key={i} className="text-[9px] text-slate-500 leading-tight mb-1 animate-pulse" style={{ animationDelay: `${i * 1}s` }}>
                                {`> [AUDIT_${i}] ${c}`}
                            </p>
                        )) || (
                            <p className="text-[9px] text-slate-600 italic leading-tight">
                                {`> NO CONTRADICTIONS DETECTED IN STRUCTURAL STREAM.`}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {analysis?.sources && analysis.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800/50 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Database className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">External Grounds:</span>
                    </div>
                    {analysis.sources.map((source, i) => (
                        <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-blue-500 hover:text-blue-400 transition-colors uppercase"
                        >
                            [{source.title.slice(0, 15)}]
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};
