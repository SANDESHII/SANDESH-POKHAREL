
import './index.css';
import React, { useState, useEffect, useMemo } from 'react';

import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { 
    Activity,
    Info
} from 'lucide-react';
import { AnalysisResult } from './types';
import { runMatchSimulation, calculateConfidenceAudit } from './services/engine';

// Components
const Header: React.FC = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-emerald-900/20 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-500" />
                <h1 className="text-sm font-black tracking-[0.2em] text-white">MATCH <span className="text-emerald-500">REPORT</span></h1>
            </div>
        </div>
    </header>
);

const LoadingOverlay: React.FC<{ loading: boolean, stage: number, messages: string[] }> = ({ loading, stage, messages }) => (
    loading ? (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
            <div className="relative">
                <div className="w-32 h-32 border-2 border-emerald-900 rounded-full animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-b-2 border-emerald-500 rounded-full animate-spin" />
                </div>
            </div>
            <div className="text-center space-y-3">
                <p className="text-[10px] font-black tracking-[0.4em] text-emerald-500 uppercase animate-pulse">
                    {messages[stage]}
                </p>
                <div className="flex gap-1 justify-center">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full ${i === stage ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-emerald-950'}`} />
                    ))}
                </div>
            </div>
        </div>
    ) : null
);

const AnalysisForm: React.FC<any> = ({ 
    home, setHome, away, setAway, league, setLeague, time, setTime, 
    onAnalyze, loading, isSearchEnabled, setIsSearchEnabled
}) => (
    <form onSubmit={(e) => { e.preventDefault(); if (!loading && home && away) onAnalyze(); }} className="bg-zinc-950 p-12 rounded-2xl border border-emerald-900/30 shadow-2xl backdrop-blur-sm max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {[
                { label: 'Home Team', val: home, set: setHome, placeholder: 'CITY' },
                { label: 'Away Team', val: away, set: setAway, placeholder: 'LIVERPOOL' },
                { label: 'League', val: league, set: setLeague, placeholder: 'PREMIER' },
                { label: 'Kickoff Time', val: time, set: setTime, placeholder: '19:45' }
            ].map((f, i) => (
                <div key={i} className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-emerald-900 font-black">{f.label}</label>
                    <input type="text" value={f.val} onChange={(e) => f.set(e.target.value.toUpperCase())} className="w-full bg-transparent border-b-2 border-emerald-950 px-0 py-4 text-3xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-emerald-950 uppercase tracking-tighter" placeholder={f.placeholder} />
                </div>
            ))}
        </div>
        <div className="mt-12 flex items-center justify-between p-4 bg-emerald-950/10 border border-emerald-900/20 rounded-xl">
            <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live Grounding</span>
                <p className="text-[9px] text-emerald-900 font-bold uppercase">Real-time data fetch enabled</p>
            </div>
            <button type="button" onClick={() => setIsSearchEnabled(!isSearchEnabled)} className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isSearchEnabled ? 'bg-emerald-600' : 'bg-zinc-800'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-black rounded-full transition-all duration-300 ${isSearchEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
        </div>
        <button type="submit" disabled={loading || !home || !away} className={`w-full mt-16 py-8 rounded-xl font-black tracking-[0.5em] text-sm transition-all ${loading || !home || !away ? 'bg-emerald-950/20 text-emerald-900' : 'bg-emerald-600 text-black hover:bg-emerald-500'}`}>
            {loading ? 'RUNNING ANALYSIS...' : 'COMMENCE ANALYSIS'}
        </button>
    </form>
);

import { ResultGrid } from './components/ResultDisplay';

const App: React.FC = () => {
    const [homeInput, setHomeInput] = useState('');
    const [awayInput, setAwayInput] = useState('');
    const [leagueInput, setLeagueInput] = useState('');
    const [timeInput, setTimeInput] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [simulation, setSimulation] = useState<any>(null);
    const [isSearchEnabled, setIsSearchEnabled] = useState<boolean>(true);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadingMessages = [
        "Analyzing data...",
        "Running simulations...",
        "Calculating probabilities...",
        "Building tactical paths...",
        "Optimizing parameters...",
        "Finalizing report..."
    ];

    // Loading Stage Advance
    useEffect(() => {
        let interval: any;
        if (loadingAnalysis) {
            interval = setInterval(() => {
                setLoadingStage(prev => (prev + 1) % loadingMessages.length);
            }, 1200);
        } else {
            setLoadingStage(0);
        }
        return () => clearInterval(interval);
    }, [loadingAnalysis]);

    // Asynchronous Simulation (Heavyweight)
    useEffect(() => {
        if (!analysis) {
            setSimulation(null);
            return;
        }

        const runAsyncSimulation = async () => {
            const minExp = analysis.minimumExpectancy || 1.2;
            const maxPot = analysis.potentialCeiling || 6.0;

            // Yield thread before running heavy computation
            setTimeout(async () => {
                const result = await runMatchSimulation(
                    analysis.probability, 
                    analysis.tacticalPath, 
                    minExp,
                    maxPot,
                    analysis.homeStats.name,
                    analysis.awayStats.name,
                    analysis.homeXG || 1.35,
                    analysis.awayXG || 1.35,
                    0.85, // accuracyWeight default
                    analysis.dependence,
                    analysis.homeStats.offensiveVolatility || 0.5,
                    analysis.awayStats.offensiveVolatility || 0.5,
                    analysis.homeStats.defensiveStability || 0.5,
                    analysis.awayStats.defensiveStability || 0.5,
                    analysis.topTacticalPaths || []
                );
                setSimulation(result);
            }, 50);
        };

        runAsyncSimulation();
    }, [analysis]);

    const surety = useMemo(() => {
        if (!analysis || !simulation) return null;
        return calculateConfidenceAudit(simulation, analysis.modelAudit);
    }, [analysis, simulation]);

    const handleAnalyze = async () => {
        if (loadingAnalysis || !homeInput || !awayInput) return;
        
        setError(null);
        setLoadingAnalysis(true);
        setLoadingStage(0);
        setAnalysis(null);
        setSimulation(null);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: homeInput.toUpperCase(),
                    awayTeam: awayInput.toUpperCase(),
                    league: (leagueInput || 'INSTITUTIONAL_ROUTING').toUpperCase(),
                    kickoff: (timeInput || 'UPCOMING').toUpperCase(),
                    isSearchEnabled: isSearchEnabled
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'ANALYSIS FAILED.');
            }

            const result: AnalysisResult = await response.json();
            setAnalysis(result);
        } catch (err: any) {
            setError(err.message || 'ANALYSIS FAILED. SIGNAL LOST.');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-emerald-500 selection:bg-emerald-500/20 font-mono">
            <Header />
            <LoadingOverlay loading={loadingAnalysis} stage={loadingStage} messages={loadingMessages} />

            <main className="max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-16">
                {/* Introduction Section */}
                {!analysis && !loadingAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-5xl mx-auto text-center space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-950/20 border border-emerald-900/30 rounded-full text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">
                            <Activity className="w-3 h-3" /> Tactical Analytics
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter text-white uppercase">
                            MATCH <span className="text-emerald-500">ANALYSIS</span>
                        </h2>
                        <p className="text-emerald-900 font-black text-[10px] tracking-[0.4em] uppercase">
                            Verified Data // Tactical Patterns // Market Sentiment
                        </p>
                    </motion.div>
                )}

                {/* Main Action Form */}
                <AnalysisForm 
                    home={homeInput} setHome={setHomeInput}
                    away={awayInput} setAway={setAwayInput}
                    league={leagueInput} setLeague={setLeagueInput}
                    time={timeInput} setTime={setTimeInput}
                    isSearchEnabled={isSearchEnabled} setIsSearchEnabled={setIsSearchEnabled}
                    onAnalyze={handleAnalyze}
                    loading={loadingAnalysis}
                />

                {error && (
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-6 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-center gap-4 text-red-500 shadow-2xl"
                    >
                        <Info className="w-5 h-5 flex-shrink-0" />
                        <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-[10px] font-black opacity-50 hover:opacity-100 underline decoration-red-900 underline-offset-4 tracking-[0.2em] uppercase">RETRY</button>
                    </motion.div>
                )}

                {/* Analysis Results Display */}
                {analysis && surety && !loadingAnalysis && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000"
                    >
                        <ResultGrid 
                            analysis={analysis} 
                            surety={surety} 
                            isOptimized={simulation?.computeOptimized} 
                        />
                    </motion.div>
                )}
            </main>

            <footer className="max-w-7xl mx-auto px-6 py-16 border-t border-emerald-900/20 flex flex-col md:flex-row items-center justify-between gap-8 text-emerald-950">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    &copy; 2024 MATCH REPORT ANALYSIS. DATA VERIFIED VIA PROPRIETARY ANALYSIS.
                </div>
            </footer>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
