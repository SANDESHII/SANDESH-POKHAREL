
import './index.css';
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
    Activity, 
    Shield,
    Zap, 
    Search,
    ArrowRight,
    Trophy,
    Target,
    Info,
    Flame,
    Cpu,
    BarChart3,
    Lock,
    Database,
    AlertTriangle,
    ChevronRight,
    Wind,
    User,
    MapPin,
    Calendar,
    History
} from 'lucide-react';
import { AnalysisResult } from './types';
import { runMonteCarloSimulation, SimulationResult } from './services/monteCarloService';
import { calculateMedallionSurety, MedallionResult } from './services/suretyService';
import { calculateEVTRisk } from './services/mathUtils';

const App: React.FC = () => {
    const [homeInput, setHomeInput] = useState('');
    const [awayInput, setAwayInput] = useState('');
    const [leagueInput, setLeagueInput] = useState('');
    const [timeInput, setTimeInput] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [surety, setSurety] = useState<MedallionResult | null>(null);
    const [status, setStatus] = useState({ depth: 0, isCoolingDown: false, cooldownRemaining: 0 });
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadingMessages = [
        "Initializing Neural Forensic Audit...",
        "Searching for real-time team news...",
        "Retrieving npxG and xT stats via Google Search...",
        "Auditing recent form and structural shifts...",
        "Detecting historical Mirror Matches...",
        "Running Monte Carlo Simulations...",
        "Finalizing the Prosecution Case...",
        "Securing Fortress Verdict..."
    ];

    useEffect(() => {
        let interval: any;
        if (loadingAnalysis) {
            interval = setInterval(() => {
                setLoadingStage(prev => (prev + 1) % loadingMessages.length);
            }, 3000);
        } else {
            setLoadingStage(0);
        }
        return () => clearInterval(interval);
    }, [loadingAnalysis]);

    useEffect(() => {
        let interval: any;
        if (loadingAnalysis || status.isCoolingDown || status.depth > 0) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    setStatus(data);
                } catch (e) {
                    console.error("Status check failed", e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [loadingAnalysis, status.isCoolingDown, status.depth]);

    const handleAnalyze = async (game: { home: string; away: string; kickoff: string }) => {
        setLoadingAnalysis(true);
        setError(null);
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeTeam: game.home,
                    awayTeam: game.away,
                    league: leagueInput || 'Unknown League',
                    kickoff: game.kickoff
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'The match data stream failed to return a valid response.');
            }

            const result: AnalysisResult = await response.json();
            
            // 2. Run Monte Carlo Simulation
            const simRes = runMonteCarloSimulation(
                result.probability, 
                result.regimePath, 
                result.structuralData.floor,
                result.physicalCeiling,
                result.homeStats.name,
                result.awayStats.name
            );

            // 3. Final Forensic Audit (Surety)
            const suretyRes = calculateMedallionSurety(
                simRes, 
                result.regimePath, 
                result.structuralData, 
                result.modelAudit.evtRisk, 
                result.signalPrecision,
                result.physics,
                result.marketReality,
                result.context,
                result.mirrorMatches,
                result.prosecution,
                result.modelAudit
            );
            
            setAnalysis(result);
            setSimulation(simRes);
            setSurety(suretyRes);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Analysis failed. Please check your connection.');
        }
        setLoadingAnalysis(false);
    };

    const handleManualAnalyze = () => {
        if (!homeInput || !awayInput) return;
        handleAnalyze({
            home: homeInput,
            away: awayInput,
            kickoff: timeInput || new Date().toISOString()
        });
    };

    const handleReset = () => {
        setHomeInput('');
        setAwayInput('');
        setLeagueInput('');
        setTimeInput('');
        setAnalysis(null);
        setSimulation(null);
        setSurety(null);
        setError(null);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 flex flex-col">
            {/* Minimal Header */}
            <nav className="border-b border-white/5 bg-black/20 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <Activity className="text-black w-6 h-6" />
                        </div>
                        <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">Match Report Pro</h1>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-5xl mx-auto w-full p-6 py-12 space-y-12">
                {/* Centered Large Manual Entry Section */}
                <section className="w-full">
                    <div className="bg-white/[0.02] border border-white/10 p-20 rounded-[5rem] shadow-2xl shadow-emerald-500/5 space-y-16">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em] italic">Match Analyst</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Statistical football intelligence</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] px-6">Home Team</label>
                                <input 
                                    type="text" 
                                    value={homeInput} 
                                    onChange={(e) => setHomeInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualAnalyze()}
                                    placeholder="HOME TEAM"
                                    className="w-full bg-black/60 border-2 border-white/5 px-10 py-6 rounded-[2.5rem] text-2xl focus:outline-none focus:border-emerald-500/50 transition-all font-black uppercase placeholder:text-slate-800 shadow-inner"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] px-6">Away Team</label>
                                <input 
                                    type="text" 
                                    value={awayInput} 
                                    onChange={(e) => setAwayInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualAnalyze()}
                                    placeholder="AWAY TEAM"
                                    className="w-full bg-black/60 border-2 border-white/5 px-10 py-6 rounded-[2.5rem] text-2xl focus:outline-none focus:border-emerald-500/50 transition-all font-black uppercase placeholder:text-slate-800 shadow-inner"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] px-6">League</label>
                                <input 
                                    type="text" 
                                    value={leagueInput} 
                                    onChange={(e) => setLeagueInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualAnalyze()}
                                    placeholder="LEAGUE"
                                    className="w-full bg-black/60 border-2 border-white/5 px-10 py-6 rounded-[2.5rem] text-2xl focus:outline-none focus:border-emerald-500/50 transition-all font-black uppercase placeholder:text-slate-800 shadow-inner"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] px-6">Time/Context</label>
                                <input 
                                    type="text" 
                                    value={timeInput} 
                                    onChange={(e) => setTimeInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleManualAnalyze()}
                                    placeholder="TIME / CONTEXT"
                                    className="w-full bg-black/60 border-2 border-white/5 px-10 py-6 rounded-[2.5rem] text-2xl focus:outline-none focus:border-emerald-500/50 transition-all font-black uppercase placeholder:text-slate-800 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            {status.depth > 0 && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl flex items-center justify-between group animate-pulse">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                            <Zap size={20} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Data Pipeline</div>
                                            <div className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-[0.2em]">{status.depth} Match Reports Queued</div>
                                        </div>
                                    </div>
                                    <div className="text-emerald-500/40 font-mono text-xs">PROCESSING...</div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4">
                                <button 
                                    onClick={handleManualAnalyze}
                                    disabled={loadingAnalysis || !homeInput || !awayInput}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-8 rounded-3xl text-lg font-black uppercase tracking-[0.4em] transition-all disabled:opacity-30 flex items-center justify-center gap-4 shadow-[0_25px_60px_rgba(16,185,129,0.2)] active:scale-[0.98]"
                                >
                                    <Zap size={24} /> {loadingAnalysis ? 'Loading Data...' : 'Run Analysis'}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Analysis Display Area */}
                <section className="space-y-8">
                    {error && (
                        <div className={`border p-8 rounded-[3rem] flex items-center gap-6 animate-in fade-in slide-in-from-top-4 ${
                            error.includes('congested') 
                            ? 'bg-amber-500/10 border-amber-500/20' 
                            : 'bg-red-500/10 border-red-500/20'
                        }`}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                error.includes('congested')
                                ? 'bg-amber-500/20'
                                : 'bg-red-500/20'
                            }`}>
                                {error.includes('congested') 
                                    ? <History className="text-amber-500" size={24} />
                                    : <AlertTriangle className="text-red-500" size={24} />
                                }
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-widest italic">
                                    {error.includes('congested') ? 'System Optimizing' : 'Analysis Aborted'}
                                </h3>
                                <p className={`${error.includes('congested') ? 'text-amber-400/80' : 'text-red-400/80'} text-sm font-bold uppercase tracking-widest`}>
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}

                    {loadingAnalysis ? (
                        <div className="h-[500px] flex flex-col items-center justify-center space-y-8 bg-white/[0.02] border border-white/5 rounded-[4rem]">
                            <div className="relative">
                                <div className="w-24 h-24 border-2 border-emerald-500/10 rounded-full animate-[spin_3s_linear_infinite]" />
                                <div className="absolute inset-0 w-24 h-24 border-t-2 border-emerald-500 rounded-full animate-spin" />
                                <Cpu className="absolute inset-0 m-auto text-emerald-500 animate-pulse" size={32} />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Real-Time Research</h3>
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em] animate-pulse h-6">
                                    {loadingMessages[loadingStage]}
                                </p>
                                <p className="text-[10px] text-slate-700 font-bold uppercase tracking-widest pt-4">This usually takes 15-20s for deep synthesis</p>
                            </div>
                        </div>
                    ) : analysis && simulation ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {/* Nuclear Fortress Status Badge */}
                            {surety?.isNuclearFortress && (
                                <div className="bg-emerald-500/10 border-2 border-emerald-500 rounded-[2rem] p-6 flex items-center justify-between animate-pulse">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                                            <Shield className="text-black" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-emerald-500 uppercase tracking-[0.2em] italic">Nuclear Fortress Detected</h3>
                                            <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Match fully secured in the 1.5-3.5 structural corridor</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {surety.fortressReasoning.slice(0, 3).map((r, i) => (
                                            <div key={i} className="px-3 py-1 bg-emerald-500/20 rounded-full text-[8px] font-black text-emerald-500 uppercase">
                                                {r}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Advanced Model Audit (The User's Request) */}
                            <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
                                <div className="flex items-center gap-3">
                                    <Cpu className="text-emerald-500" size={20} />
                                    <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Advanced Neural Audit</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Hierarchical Poisson</span>
                                            <span className="text-lg font-black text-white italic">{(analysis.modelAudit.bayesianPoisson * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-[2s]" style={{ width: `${analysis.modelAudit.bayesianPoisson * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Gradient Boosting (LGBM)</span>
                                            <span className="text-lg font-black text-white italic">{(analysis.modelAudit.gradientBoosting * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all duration-[2s]" style={{ width: `${analysis.modelAudit.gradientBoosting * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">Shannon Entropy (Noise)</span>
                                            <span className="text-lg font-black text-white italic">{(analysis.modelAudit.entropy * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 transition-all duration-[2s]" style={{ width: `${analysis.modelAudit.entropy * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase font-mono">EVT Tail Risk</span>
                                            <span className="text-lg font-black text-white italic">{(analysis.modelAudit.evtRisk * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500 transition-all duration-[2s]" style={{ width: `${analysis.modelAudit.evtRisk * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dual Prediction Hero Section - RE-ENGINEERED FOR MASTERY CORRIDOR */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Prediction 01: Mastery Corridor (The Tactical Play) */}
                                <div className={`p-12 rounded-[5rem] relative overflow-hidden shadow-2xl group transition-all duration-500 ${
                                    surety?.masteryCorridor.anchor === 'OVER 1.5' ? 'bg-emerald-500 shadow-emerald-500/20' : 
                                    (surety?.masteryCorridor.anchor === 'UNDER 3.5' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-slate-800')
                                }`}>
                                    <div className="absolute top-0 right-0 p-16 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                                        <Zap size={350} />
                                    </div>
                                    <div className="relative z-10 space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="px-6 py-2 bg-white/10 backdrop-blur-md rounded-full flex items-center gap-3 border border-white/10">
                                                <Shield className="text-white" size={18} />
                                                <span className="text-xs font-black text-white uppercase tracking-[0.3em]">P10 Estimate: Lower Bound Audit</span>
                                            </div>
                                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest italic font-serif">Structural Convergence Logic</div>
                                        </div>
                                        
                                        {surety && (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none">P10 Structural Estimate</div>
                                                    <h2 className="text-6xl md:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.85] py-2">
                                                        {surety.p10StructuralEstimate.verdict}
                                                    </h2>
                                                </div>
                                                
                                                <div className="flex flex-col gap-6 pt-4">
                                                    <div className="flex items-center gap-8">
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-black text-white/60 uppercase">Confidence</div>
                                                            <div className="text-4xl font-black text-white italic">{surety.p10StructuralEstimate.confidence.toFixed(1)}%</div>
                                                        </div>
                                                        <div className="h-12 w-px bg-white/10" />
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-black text-white/60 uppercase">Tactical Anchor</div>
                                                            <div className="text-4xl font-black text-white italic">{surety.masteryCorridor.anchor}</div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] font-black text-white/80 uppercase tracking-wider leading-relaxed border-t border-white/10 pt-4 max-w-sm">
                                                        {surety.p10StructuralEstimate.reasoning}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Prediction 02: Infallible Physical Limits */}
                                <div className="bg-white/[0.03] border border-white/10 p-16 rounded-[5rem] relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                                        <Target size={350} />
                                    </div>
                                    <div className="relative z-10 space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="px-6 py-2 bg-white/5 backdrop-blur-md rounded-full flex items-center gap-3 border border-white/10">
                                                <Activity className="text-emerald-500" size={18} />
                                                <span className="text-xs font-black text-white uppercase tracking-[0.3em]">Boundary Analysis: Limits of Chaos</span>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Physical Space Audit</div>
                                        </div>
                                        <div className="space-y-8">
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Infallible Structural Ceiling</div>
                                                <h2 className="text-6xl md:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.85] py-2">
                                                    {simulation.infallibleAudit.limitVerdict}
                                                </h2>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8 pt-4">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase">Chaos Threshold</div>
                                                    <div className="text-4xl font-black text-blue-500 italic uppercase">U{simulation.infallibleAudit.physicalCeiling + 0.5} <span className="text-[10px] text-slate-600 tracking-normal opacity-50 not-italic">(Limit)</span></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase">Tactical Range</div>
                                                    <div className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none pt-1">{simulation.infallibleAudit.range}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Triple-Lock Verification Panel */}
                            <div className="bg-[#0A0A0A] border border-white/10 rounded-[4rem] p-12 relative overflow-hidden animate-in fade-in zoom-in duration-1000">
                                <div className="absolute top-0 right-0 p-12 opacity-5">
                                    <Lock size={200} />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                                    <div className="space-y-4 max-w-sm text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start gap-4">
                                            <div className={`w-3 h-3 rounded-full animate-pulse ${surety?.isNuclearFortress ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.7)]' : (surety?.verdict === 'GOLD' ? 'bg-emerald-500/50' : 'bg-amber-500/50')}`} />
                                            <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
                                                {surety?.isNuclearFortress ? 'FORTRESS SECURED' : 'Triple-Lock Status'}
                                            </h3>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                            Renaissance-Tier execution requires simultaneous activation of all three defensive logic gates.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 flex-1">
                                            {/* Lock 1: P10 Structural Floor */}
                                            <div className={`p-6 rounded-3xl border transition-all duration-500 flex flex-col items-center gap-4 ${
                                                surety?.p10StructuralEstimate.confidence && surety.p10StructuralEstimate.confidence > 75 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5'
                                            }`}>
                                                <div className={`p-3 rounded-xl ${surety?.p10StructuralEstimate.confidence && surety.p10StructuralEstimate.confidence > 75 ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}>
                                                    <Database size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Lock 01: P10 Floor</div>
                                                    <div className={`text-sm font-black italic uppercase ${surety?.p10StructuralEstimate.confidence && surety.p10StructuralEstimate.confidence > 75 ? 'text-white' : 'text-slate-600'}`}>
                                                        {surety?.p10StructuralEstimate.confidence && surety.p10StructuralEstimate.confidence > 75 ? 'ALIGNED' : 'SKEWED'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lock 2: The Prosecutor */}
                                            <div className={`p-6 rounded-3xl border transition-all duration-500 flex flex-col items-center gap-4 ${
                                                surety?.prosecutionRisk && surety.prosecutionRisk < 45 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5'
                                            }`}>
                                                <div className={`p-3 rounded-xl ${surety?.prosecutionRisk && surety.prosecutionRisk < 45 ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}>
                                                    <Shield size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Lock 02: Prosecutor</div>
                                                    <div className={`text-sm font-black italic uppercase ${surety?.prosecutionRisk && surety.prosecutionRisk < 45 ? 'text-white' : 'text-slate-600'}`}>
                                                        {surety?.prosecutionRisk && surety.prosecutionRisk < 45 ? 'SILENCED' : 'ACTIVE'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lock 3: Stress Test */}
                                            <div className={`p-6 rounded-3xl border transition-all duration-500 flex flex-col items-center gap-4 ${
                                                surety?.survivalRating && surety.survivalRating > 88 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5'
                                            }`}>
                                                <div className={`p-3 rounded-xl ${surety?.survivalRating && surety.survivalRating > 88 ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 bg-white/5'}`}>
                                                    <Zap size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Lock 03: Stress Test</div>
                                                    <div className={`text-sm font-black italic uppercase ${surety?.survivalRating && surety.survivalRating > 88 ? 'text-white' : 'text-slate-600'}`}>
                                                        {surety?.survivalRating && surety.survivalRating > 88 ? 'SECURE' : 'FRAGILE'}
                                                    </div>
                                                </div>
                                            </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/10 rounded-[4rem] overflow-hidden">
                                <div className="p-10 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                            <BarChart3 className="text-blue-500" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Structural Reality Audit</h3>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Multi-Market Forensic Ranking</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">10,000 Iterations</div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5">
                                                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">Market Reality</th>
                                                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Raw Prob</th>
                                                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Tactical Alignment</th>
                                                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Final Surety</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {surety?.marketAudits.sort((a, b) => b.suretyScore - a.suretyScore).map((market, i) => (
                                                <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${market.name === surety.bestBet?.name ? 'bg-emerald-500/5' : ''}`}>
                                                    <td className="p-8">
                                                        <div className="flex items-center gap-4">
                                                            {market.name === surety.bestBet?.name && <Zap size={14} className="text-emerald-500" />}
                                                            <span className={`text-sm font-black italic uppercase tracking-tight ${market.name === surety.bestBet?.name ? 'text-emerald-500' : 'text-white'}`}>
                                                                {market.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-center">
                                                        <span className="text-sm font-black text-slate-400 italic">{market.rawProb.toFixed(1)}%</span>
                                                    </td>
                                                    <td className="p-8 text-center">
                                                        <div className={`text-[10px] font-black px-3 py-1 rounded-full inline-block ${
                                                            market.regimeAlignment > 0 ? 'bg-emerald-500/10 text-emerald-500' : 
                                                            (market.regimeAlignment < 0 ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-slate-500')
                                                        }`}>
                                                            {market.regimeAlignment > 0 ? `+${market.regimeAlignment}%` : (market.regimeAlignment < 0 ? `${market.regimeAlignment}%` : 'NEUTRAL')}
                                                        </div>
                                                    </td>
                                                    <td className="p-8 text-right">
                                                        <span className={`text-lg font-black italic ${market.name === surety.bestBet?.name ? 'text-emerald-500' : 'text-white'}`}>
                                                            {market.suretyScore.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Forensic Interdependence & EVT Data Stream */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Shield className="text-emerald-500" size={20} />
                                        <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Interdependent Factors</h3>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Signal Precision (P)</div>
                                            <div className={`text-xl font-black italic ${surety?.signalPrecision && surety.signalPrecision < 0.4 ? 'text-red-500' : 'text-white'}`}>
                                                {surety?.signalPrecision.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Physics Audit (MET)</div>
                                            <div className={`text-xl font-black italic ${surety?.physicsAudit.metAudit ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {surety?.physicsAudit.metAudit ? 'PASSED' : 'FAILED'}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Stress Survival</div>
                                            <div className={`text-xl font-black italic ${surety?.survivalRating && surety.survivalRating < 70 ? 'text-red-500' : 'text-white'}`}>
                                                {surety?.survivalRating.toFixed(0)}%
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Pattern Closure</div>
                                            <div className="text-xl font-black text-amber-500 italic">{(surety?.mirrorSimilarity || 0).toFixed(0)}%</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Safe Cushion</div>
                                            <div className="text-xl font-black text-emerald-500 italic">OVER {surety?.cushionFloor.toFixed(1)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Zap className="text-red-500" size={20} />
                                        <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">EVT Tail Audit</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Black Swan Probability</span>
                                            <span className="text-2xl font-black text-red-500 italic">{surety?.evtTailRisk.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-red-500 transition-all duration-1000" 
                                                style={{ width: `${surety?.evtTailRisk}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                                            Extreme Value Theory (EVT) models the probability of structural collapse or blowout. 
                                            Values above 60% indicate high volatility in the match DNA.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Forensic Engine Status Bar */}
                            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-[2rem] flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L1: Steel npxG</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L2: Neural Bridge (LSTM)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L3: Bayesian Hierarchy</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L4: Boosting Ensembles</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L5: Regime Partitioning</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L6: Shannon Entropy Audit</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L7: EVT Black Swan Detection</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">L8: Monte Carlo Iteration</span>
                                </div>
                            </div>

                            {/* Match Summary & Teams */}
                            <div className="bg-white/[0.02] border border-white/10 p-16 rounded-[4.5rem] space-y-10">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                    <div className="max-w-2xl">
                                        <p className="text-2xl text-white leading-tight font-black italic uppercase tracking-tight">
                                            {analysis.homeStats.name} VS {analysis.awayStats.name}
                                        </p>
                                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2">
                                            {analysis.summary}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Match Intensity</div>
                                            <div className="text-lg font-black text-emerald-500 italic uppercase leading-none">{analysis.probability}%</div>
                                        </div>
                                        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                                            <Zap className="text-black" size={32} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                             {/* Secondary Analysis Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* The Prosecution (Inside Inversion Audit) */}
                                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6 group hover:border-red-500/30 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                                            <AlertTriangle className="text-red-500" size={24} />
                                        </div>
                                        <div className="text-[8px] font-black text-red-500 uppercase tracking-widest italic">The Prosecution Case</div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Inversion Audit</h3>
                                        <div className="space-y-3">
                                            {analysis.prosecution.contradictions.map((c, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <div className="w-1.5 h-1.5 bg-red-500/50 rounded-full mt-1.5 shrink-0" />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Contradiction Risk</span>
                                            <span className="text-2xl font-black text-red-500 italic">{analysis.prosecution.riskScore}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Ancestral Law (Mirror Matches) */}
                                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6 group hover:border-amber-500/30 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
                                            <History className="text-amber-500" size={24} />
                                        </div>
                                        <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest italic">Mirror DNA Anchors</div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Historical Mirror</h3>
                                        <div className="space-y-3">
                                            {analysis.mirrorMatches.map((m, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/5">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase truncate max-w-[120px]">{m.match}</span>
                                                    <span className="text-[9px] font-black text-amber-500 italic">{m.result}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Pattern Similarity</span>
                                            <span className="text-2xl font-black text-white italic">{(surety?.mirrorSimilarity || 0).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Regime Shift detection (Tactical Breakpoints) */}
                                <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] space-y-6 group hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                                            <BarChart3 className="text-emerald-500" size={24} />
                                        </div>
                                        <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">State Path</div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Tactical Partitioning</h3>
                                        <div className="flex flex-col gap-2">
                                            {analysis.regimePath.map((step, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <div className="w-1 h-4 bg-emerald-500/20 rounded-full" />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{step.regime.replace('_', ' ')}</span>
                                                    <div className="flex-1 h-[1px] bg-white/5" />
                                                    <span className="text-[9px] font-bold text-emerald-500">{(step.confidence * 100).toFixed(0)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {surety && (
                                        <div className="pt-4 border-t border-white/5">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">EVT Tail Risk</span>
                                                <span className={`text-2xl font-black italic ${surety.evtTailRisk > 60 ? 'text-red-500' : 'text-white'}`}>
                                                    {surety.evtTailRisk.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Market Reality & Medallion Surety */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-12 bg-white/[0.02] border border-white/5 p-12 rounded-[3.5rem] space-y-8 relative overflow-hidden">
                                    {surety?.isNuclearFortress ? (
                                        <div className="absolute top-0 right-0 px-12 py-4 bg-emerald-500 text-black font-black text-xs uppercase tracking-[0.5em] italic -rotate-0 rounded-bl-[2rem] shadow-2xl shadow-emerald-500/50 flex items-center gap-3 animate-pulse">
                                            <Activity size={16} /> Nuclear Fortress
                                        </div>
                                    ) : surety?.isMedallionSurety && (
                                        <div className="absolute top-0 right-0 px-12 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-[0.5em] italic -rotate-0 rounded-bl-[2rem] shadow-2xl shadow-amber-500/50 flex items-center gap-3">
                                            <Shield size={16} /> Medallion Surety
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                        <Lock size={14} /> Market Reality Audit
                                    </div>

                                    {surety?.isNuclearFortress && (
                                        <div className="mt-4 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                                                    <Zap className="text-black" size={16} />
                                                </div>
                                                <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Fortress Protocol: Convergence Layers</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {surety.fortressReasoning.map((reason, idx) => (
                                                    <span key={idx} className="px-3 py-1 bg-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-tight border border-emerald-500/30">
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Syndicate Flow</div>
                                            <div className={`text-sm font-black uppercase italic ${
                                                analysis.marketReality.syndicateFlow === 'HIGH' ? 'text-amber-500' : 'text-white'
                                            }`}>
                                                {analysis.marketReality.syndicateFlow}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Smart Money Target</div>
                                            <div className="text-sm font-black text-white uppercase italic">{analysis.marketReality.smartMoneyTarget}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Market Divergence</div>
                                            <div className="text-sm font-black text-white uppercase italic">{analysis.marketReality.marketDivergence.toFixed(1)}%</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase">Sentiment Shadow</div>
                                            <div className="text-sm font-black text-white uppercase italic">{analysis.marketReality.sentimentScore.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-white/5">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Forensic Audit Note</div>
                                                <p className="text-xs font-bold text-slate-300 italic">"{surety?.auditNote}"</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Surety Score</div>
                                                    <div className="text-2xl font-black text-white italic">{surety?.suretyScore.toFixed(1)}%</div>
                                                </div>
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                                                    surety?.verdict === 'GOLD' ? 'bg-amber-500 text-black' : 
                                                    surety?.verdict === 'SILVER' ? 'bg-slate-400 text-black' : 'bg-white/10 text-white'
                                                }`}>
                                                    <Trophy size={28} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Match Context & Grounding */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-12 bg-white/[0.02] border border-white/5 p-12 rounded-[3.5rem] space-y-8">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                        <MapPin size={14} /> Environmental Context
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase flex items-center gap-1"><Wind size={10} /> Weather</div>
                                            <div className="text-xs font-black text-white uppercase italic">{analysis.context.weather}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase flex items-center gap-1"><User size={10} /> Referee</div>
                                            <div className="text-xs font-black text-white uppercase italic">{analysis.context.referee}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase flex items-center gap-1"><MapPin size={10} /> Stadium</div>
                                            <div className="text-xs font-black text-white uppercase italic">{analysis.context.stadium}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] font-bold text-slate-600 uppercase flex items-center gap-1"><Zap size={10} /> Stakes</div>
                                            <div className="text-xs font-black text-white uppercase italic">{analysis.context.stakes}</div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-white/5 space-y-4">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                                            <Info size={14} /> Grounding Sources
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {analysis.sources.map((source, i) => (
                                                <a 
                                                    key={i} 
                                                    href={source.uri} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center gap-2"
                                                >
                                                    <Search size={12} />
                                                    {source.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Footnote: Reset Engine */}
                                    <div className="pt-12 border-t border-white/10 flex justify-center">
                                        <button 
                                            onClick={handleReset}
                                            className="group flex flex-col items-center gap-4 hover:opacity-80 transition-all"
                                        >
                                            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center group-hover:bg-red-500/10 group-hover:border-red-500/20 transition-all">
                                                <Activity size={24} className="text-slate-500 group-hover:text-red-500" />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Purge Cache & Reset Engine</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center space-y-8 bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[4rem]">
                            <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Zap className="text-slate-800" size={48} />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-2xl font-black text-slate-600 italic uppercase tracking-tighter">Awaiting Target Acquisition</h3>
                                <p className="text-slate-700 text-xs font-bold uppercase tracking-[0.3em]">Input match parameters above to initiate forensic audit</p>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* Footer Status Bar */}
            <footer className="border-t border-white/5 bg-black/40 p-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Online</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Regime Engine: Online</span>
                        </div>
                    </div>
                    <div className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                        © 2026 Nuclear Fortress • Forensic Match Intelligence v4.2.0
                    </div>
                </div>
            </footer>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
