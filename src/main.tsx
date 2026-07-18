
import './index.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { Activity, Info } from 'lucide-react';
import { AnalysisResult } from './types';
import { ResultGrid } from './components/ResultDisplay';
import { BacktestDisplay } from './components/BacktestDisplay';

// Components
const Header: React.FC = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-500" />
                <h1 className="text-sm font-black tracking-[0.2em] text-white uppercase">Quantitative <span className="text-emerald-500">Football AI</span></h1>
            </div>
        </div>
    </header>
);

const LoadingOverlay: React.FC<{ loading: boolean, stage: number, messages: string[] }> = ({ loading, stage, messages }) => (
    loading ? (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center space-y-8">
            <div className="relative">
                <div className="w-24 h-24 border-t-2 border-emerald-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
                    <Activity className="w-8 h-8 animate-pulse" />
                </div>
            </div>
            <div className="text-center space-y-3">
                <p className="text-[10px] font-black tracking-[0.4em] text-emerald-500 uppercase">
                    {messages[stage]}
                </p>
                <div className="flex gap-1 justify-center">
                    {messages.map((_, i) => (
                        <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${i === stage ? 'bg-emerald-500 w-4' : 'bg-emerald-950'}`} />
                    ))}
                </div>
            </div>
        </div>
    ) : null
);

interface AnalysisFormProps {
    home: string;
    setHome: (v: string) => void;
    away: string;
    setAway: (v: string) => void;
    league: string;
    setLeague: (v: string) => void;
    time: string;
    setTime: (v: string) => void;
    onAnalyze: () => void;
    loading: boolean;
    isSearchEnabled: boolean;
    setIsSearchEnabled: (v: boolean) => void;
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({ 
    home, setHome, away, setAway, league, setLeague, time, setTime, 
    onAnalyze, loading, isSearchEnabled, setIsSearchEnabled
}) => (
    <form 
        onSubmit={(e) => { e.preventDefault(); if (!loading && home && away) onAnalyze(); }} 
        className="bg-zinc-950 p-12 rounded-2xl border border-white/5 shadow-2xl max-w-5xl mx-auto"
    >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {[
                { label: 'Home Team', val: home, set: setHome, placeholder: 'CITY' },
                { label: 'Away Team', val: away, set: setAway, placeholder: 'LIVERPOOL' },
                { label: 'League', val: league, set: setLeague, placeholder: 'PREMIER' },
                { label: 'Kickoff', val: time, set: setTime, placeholder: '19:45' }
            ].map((f, i) => (
                <div key={i} className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black">{f.label}</label>
                    <input 
                        type="text" 
                        value={f.val} 
                        onChange={(e) => f.set(e.target.value.toUpperCase())} 
                        className="w-full bg-transparent border-b border-zinc-900 px-0 py-4 text-3xl text-white focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-zinc-900 uppercase tracking-tighter" 
                        placeholder={f.placeholder} 
                    />
                </div>
            ))}
        </div>
        <div className="mt-12 flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-xl">
            <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live Grounding</span>
                <p className="text-[9px] text-zinc-600 font-bold uppercase">Real-time data fetch enabled</p>
            </div>
            <button 
                type="button" 
                onClick={() => setIsSearchEnabled(!isSearchEnabled)} 
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isSearchEnabled ? 'bg-emerald-600' : 'bg-zinc-800'}`}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isSearchEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
        </div>
        <button 
            type="submit" 
            disabled={loading || !home || !away} 
            className={`w-full mt-16 py-8 rounded-xl font-black tracking-[0.5em] text-sm transition-all ${loading || !home || !away ? 'bg-zinc-900 text-zinc-600' : 'bg-emerald-600 text-black hover:bg-emerald-500'}`}
        >
            {loading ? 'PROCESSING...' : 'RUN ANALYSIS'}
        </button>
    </form>
);

import { fetchWithTimeout } from './lib/fetchUtils';

const App: React.FC = () => {
    const [homeInput, setHomeInput] = useState('');
    const [awayInput, setAwayInput] = useState('');
    const [leagueInput, setLeagueInput] = useState('');
    const [timeInput, setTimeInput] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isSearchEnabled, setIsSearchEnabled] = useState<boolean>(true);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [lastRequestTime, setLastRequestTime] = useState<number>(0);
    const RATE_LIMIT_MS = 15000; // 15 seconds client-side throttle

    const loadingMessages = [
        "Initializing engine...",
        "Fetching data...",
        "Analyzing trends...",
        "Projecting paths...",
        "Calculating goals...",
        "Finalizing..."
    ];

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

    const handleAnalyze = async () => {
        if (loadingAnalysis || !homeInput || !awayInput) return;
        
        const now = Date.now();
        if (now - lastRequestTime < RATE_LIMIT_MS) {
            const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastRequestTime)) / 1000);
            setError(`RATE LIMIT: Please wait ${waitSec}s before re-analysis.`);
            return;
        }

        setError(null);
        setLoadingAnalysis(true);
        setLoadingStage(0);
        setAnalysis(null);
        setLastRequestTime(now);

        try {
            // Use a longer timeout for the complex analysis endpoint
            const response = await fetchWithTimeout('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: homeInput.toUpperCase(),
                    awayTeam: awayInput.toUpperCase(),
                    league: (leagueInput || 'STANDARD').toUpperCase(),
                    kickoff: (timeInput || 'UPCOMING').toUpperCase(),
                    isSearchEnabled: isSearchEnabled
                })
            }, 60000); // 60s timeout for AI search + analysis

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
                {!analysis && !loadingAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-5xl mx-auto text-center space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 rounded-full text-[10px] font-black text-emerald-500 tracking-[0.3em] uppercase">
                            <Activity className="w-3 h-3" /> Analysis
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter text-white uppercase">
                            Quantitative <span className="text-emerald-500">Football AI</span>
                        </h2>
                        <p className="text-zinc-600 font-black text-[10px] tracking-[0.4em] uppercase">
                            Tactical Patterns // Verified Projections
                        </p>
                    </motion.div>
                )}

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

                {analysis && analysis.surety && !loadingAnalysis && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000"
                    >
                        <ResultGrid 
                            analysis={analysis} 
                            surety={analysis.surety} 
                        />
                    </motion.div>
                )}

                <section className="pt-24 border-t border-white/5">
                    <BacktestDisplay />
                </section>
            </main>

            <footer className="max-w-7xl mx-auto px-6 py-16 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 text-zinc-800">
                <div className="text-[10px] font-black uppercase tracking-widest">
                    &copy; 2024 Quantitative Football AI. PROPRIETARY DATA.
                </div>
            </footer>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);