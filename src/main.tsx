
import './index.css';
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { 
    Info,
    History,
    Activity
} from 'lucide-react';
import { AnalysisResult } from './types';
import { runMonteCarloSimulation } from './services/monteCarloService';
import { calculateMedallionSurety } from './services/suretyService';
import { calibrateMatchParameters } from './services/mathUtils';

// Components
import { Header } from './components/Header';
import { AnalysisForm } from './components/AnalysisForm';
import { ResultGrid } from './components/ResultDisplay';
import { LogPanel } from './components/LogPanel';
import { LoadingOverlay } from './components/LoadingOverlay';

const App: React.FC = () => {
    const [homeInput, setHomeInput] = useState('');
    const [awayInput, setAwayInput] = useState('');
    const [leagueInput, setLeagueInput] = useState('');
    const [timeInput, setTimeInput] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [simulation, setSimulation] = useState<any>(null);
    const [userConfidence, setUserConfidence] = useState<number>(0.85);
    const [status, setStatus] = useState({ depth: 0, isCoolingDown: false, cooldownRemaining: 0, message: '' });
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadingMessages = [
        "ESTABLISHING GROUNDING LINK...",
        "INDEXING NPXG METRICS...",
        "AUDITING SQUAD STABILITY...",
        "DETERMINING COMPUTE HEURISTICS...",
        "EXECUTING ADAPTIVE MONTE CARLO LOOPS...",
        "VERIFYING DIXON-COLES INTEGRITY..."
    ];

    // Status Polling
    useEffect(() => {
        const pollStatus = async () => {
            try {
                const res = await fetch('/api/status');
                if (res.ok) {
                    const data = await res.json();
                    setStatus(prev => ({ ...prev, ...data }));
                }
            } catch (err) {}
        };

        const interval = setInterval(pollStatus, 3000);
        pollStatus();
        return () => clearInterval(interval);
    }, []);

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

    // Data Processing (Lightweight)
    const calibratedData = useMemo(() => {
        if (!analysis || !analysis.homeStats.matchHistory || !analysis.awayStats.matchHistory) return null;
        return calibrateMatchParameters(analysis.homeStats.matchHistory, analysis.awayStats.matchHistory);
    }, [analysis]);

    // Asynchronous Simulation (Heavyweight)
    useEffect(() => {
        if (!analysis) {
            setSimulation(null);
            return;
        }

        const runAsyncSimulation = async () => {
            const floor = calibratedData?.structuralFloor || analysis.structuralFloor || 1.2;
            const ceiling = calibratedData?.physicalCeiling || analysis.physicalCeiling || 6.0;

            // Yield thread before running heavy computation
            setTimeout(async () => {
                const result = await runMonteCarloSimulation(
                    analysis.probability, 
                    analysis.regimePath, 
                    floor,
                    ceiling,
                    analysis.homeStats.name,
                    analysis.awayStats.name,
                    calibratedData?.homeLambda || 1.35,
                    calibratedData?.awayMu || 1.35,
                    userConfidence,
                    analysis.rho
                );
                setSimulation(result);
            }, 50);
        };

        runAsyncSimulation();
    }, [analysis, calibratedData, userConfidence]);

    const surety = useMemo(() => {
        if (!analysis || !simulation) return null;
        return calculateMedallionSurety(
            simulation, 
            analysis.regimePath, 
            analysis.structuralData, 
            analysis.modelAudit.evtRisk, 
            analysis.signalPrecision,
            analysis.physics,
            analysis.marketReality,
            analysis.context,
            analysis.mirrorMatches,
            analysis.prosecution,
            analysis.modelAudit
        );
    }, [analysis, simulation]);

    const handleAnalyze = async () => {
        if (loadingAnalysis || !homeInput || !awayInput) return;
        setLoadingAnalysis(true);
        setLoadingStage(0); // Reset progress indicators
        setAnalysis(null); 
        setSimulation(null);
        setError(null);
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: homeInput.toUpperCase(),
                    awayTeam: awayInput.toUpperCase(),
                    league: (leagueInput || 'INSTITUTIONAL_ROUTING').toUpperCase(),
                    kickoff: (timeInput || 'UPCOMING').toUpperCase()
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'ANALYSIS FAILED TO RETURN VALID DATA.');
            }

            const result: AnalysisResult = await response.json();
            setAnalysis(result);
            if (result.context?.confidenceVector) {
                setUserConfidence(result.context.confidenceVector);
            }
        } catch (err: any) {
            setError(err.message || 'ANALYSIS FAILED. SIGNAL LOST.');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-emerald-500 selection:bg-emerald-500/20 font-sans">
            <Header status={status} />
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
                            <Activity className="w-3 h-3" /> Professional Grade
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter text-white uppercase">
                            INSTITUTIONAL <span className="text-emerald-500">ANALYSIS</span>
                        </h2>
                        <p className="text-emerald-900 font-black text-[10px] tracking-[0.4em] uppercase">
                            Empirical Data // Structural Integrity // Market Reality
                        </p>
                    </motion.div>
                )}

                {/* Main Action Form */}
                <AnalysisForm 
                    home={homeInput} setHome={setHomeInput}
                    away={awayInput} setAway={setAwayInput}
                    league={leagueInput} setLeague={setLeagueInput}
                    time={timeInput} setTime={setTimeInput}
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
                        className="animate-in fade-in slide-in-from-bottom-4 duration-1000"
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
                <div className="flex items-center gap-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">ID: <span className="text-emerald-900 font-mono">MF-PRO-001</span></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-950" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">SECURITY: <span className="text-emerald-900">LEVEL 4</span></span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    &copy; 2024 FORTRESS PRO. AUDITED UNDER NUCLEAR CONSENSUS PROTOCOL.
                </div>
            </footer>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
