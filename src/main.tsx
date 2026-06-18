
import './index.css';
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { 
    Info,
    History
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
    const [userConfidence, setUserConfidence] = useState<number>(0.85);
    const [status, setStatus] = useState({ depth: 0, isCoolingDown: false, cooldownRemaining: 0, message: '' });
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadingMessages = [
        "Initializing Nuclear Forensic Audit...",
        "Calibrating Vendor Bias (Opta Baseline Matrix)...",
        "Warming Recursive Filters (10-Game Historical State)...",
        "Identifying Data Source Variance...",
        "Searching for Exogenous Overrides (Manager/Injuries)...",
        "Calculating npxG and xT Structural Floor...",
        "Detecting historical Mirror Matches...",
        "Running Monte Carlo Simulations...",
        "Finalizing the Prosecution Case...",
        "Securing Fortress Verdict..."
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

        const interval = setInterval(pollStatus, 4000);
        pollStatus();
        return () => clearInterval(interval);
    }, []);

    // Loading Stage Advance
    useEffect(() => {
        let interval: any;
        if (loadingAnalysis) {
            interval = setInterval(() => {
                setLoadingStage(prev => (prev + 1) % loadingMessages.length);
            }, 2500);
        } else {
            setLoadingStage(0);
        }
        return () => clearInterval(interval);
    }, [loadingAnalysis]);

    // Data Processing
    const calibratedData = useMemo(() => {
        if (!analysis || !analysis.homeStats.matchHistory || !analysis.awayStats.matchHistory) return null;
        return calibrateMatchParameters(analysis.homeStats.matchHistory, analysis.awayStats.matchHistory);
    }, [analysis]);

    const simulation = useMemo(() => {
        if (!analysis) return null;
        const floor = calibratedData?.structuralFloor || analysis.structuralFloor || 1.2;
        const ceiling = calibratedData?.physicalCeiling || analysis.physicalCeiling || 6.0;

        return runMonteCarloSimulation(
            analysis.probability, 
            analysis.regimePath, 
            floor,
            ceiling,
            analysis.homeStats.name,
            analysis.awayStats.name,
            userConfidence,
            analysis.rho
        );
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
        if (!homeInput || !awayInput) return;
        setLoadingAnalysis(true);
        setError(null);
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: homeInput,
                    awayTeam: awayInput,
                    league: leagueInput || 'INSTITUTIONAL_ROUTING',
                    kickoff: timeInput || 'UPCOMING'
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'The match data stream failed to return a valid response.');
            }

            const result: AnalysisResult = await response.json();
            setAnalysis(result);
            if (result.context?.confidenceVector) {
                setUserConfidence(result.context.confidenceVector);
            }
        } catch (err: any) {
            setError(err.message || 'Analysis failed. System signal lost.');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
            <Header status={status} />
            <LoadingOverlay loading={loadingAnalysis} stage={loadingStage} messages={loadingMessages} />

            <main className="max-w-7xl mx-auto px-6 pt-32 pb-24 space-y-12">
                {/* Introduction Section */}
                {!analysis && !loadingAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-3xl space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 font-mono">System Status: Active</span>
                        </div>
                        <h2 className="text-5xl font-black tracking-tighter text-white leading-[0.9]">
                            QUANTITATIVE FORENSIC <br/>
                            <span className="text-slate-600 italic">MATCH VERDICT ENGINE.</span>
                        </h2>
                        <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl">
                            Deploying institutional-grade Monte Carlo simulations and recursive Kalman state estimators to neutralize market noise in the Over 1.5 and Under 3.5 corridors.
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
                        className="p-4 bg-red-950/20 border border-red-500/30 rounded-xl flex items-center gap-4 text-red-500"
                    >
                        <Info className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-bold uppercase tracking-widest font-mono">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">DISMISS</button>
                    </motion.div>
                )}

                {/* Analysis Results Display */}
                {analysis && surety && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700"
                    >
                        <ResultGrid analysis={analysis} surety={surety} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <LogPanel analysis={analysis} />
                            </div>
                            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <History className="w-5 h-5 text-slate-500" />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Institutional Constraints</h3>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            <span>System Volatility (Tax)</span>
                                            <span className="font-mono text-white">{(surety.contextualVolatility * 10).toFixed(1)} UNITS</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${surety.contextualVolatility * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            <span>EVT Tail Risk (Audit)</span>
                                            <span className="font-mono text-white">{surety.evtTailRisk.toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" style={{ width: `${surety.evtTailRisk}%` }} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic border-t border-slate-800/50 pt-4">
                                        "Matches with high system volatility and EVT risk are structurally pruned from Medallion status to protect capital integrity."
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>

            <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-8 text-slate-600">
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Institutional ID: <span className="text-slate-400">MF-PRO-001</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-800" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Clearance: <span className="text-slate-400">LEVEL 4</span></span>
                </div>
                <div className="text-[10px] font-mono text-slate-700">
                    &copy; 2024 MATCH FORTRESS PRO. ALL ASSETS SECURED UNDER INSTITUTIONAL AUDIT.
                </div>
            </footer>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
