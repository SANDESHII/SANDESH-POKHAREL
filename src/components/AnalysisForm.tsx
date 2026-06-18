
import React from 'react';
import { Search, MapPin, Trophy, Calendar } from 'lucide-react';

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
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ home, setHome, away, setAway, league, setLeague, time, setTime, onAnalyze, loading }) => {
    return (
        <div className="bg-zinc-950 p-12 rounded-2xl border border-emerald-900/30 shadow-2xl backdrop-blur-sm max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-emerald-900 font-black flex items-center gap-2">
                        Home Team
                    </label>
                    <input 
                        type="text" 
                        value={home}
                        onChange={(e) => setHome(e.target.value.toUpperCase())}
                        className="w-full bg-transparent border-b-2 border-emerald-950 px-0 py-4 text-3xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-emerald-950 uppercase tracking-tighter"
                        placeholder="CITY"
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-emerald-900 font-black flex items-center gap-2">
                        Away Team
                    </label>
                    <input 
                        type="text" 
                        value={away}
                        onChange={(e) => setAway(e.target.value.toUpperCase())}
                        className="w-full bg-transparent border-b-2 border-emerald-950 px-0 py-4 text-3xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-emerald-950 uppercase tracking-tighter"
                        placeholder="LIVERPOOL"
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-emerald-900 font-black flex items-center gap-2">
                        League
                    </label>
                    <input 
                        type="text" 
                        value={league}
                        onChange={(e) => setLeague(e.target.value.toUpperCase())}
                        className="w-full bg-transparent border-b-2 border-emerald-950 px-0 py-4 text-3xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-emerald-950 uppercase tracking-tighter"
                        placeholder="PREMIER"
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-emerald-900 font-black flex items-center gap-2">
                        Kickoff Time
                    </label>
                    <input 
                        type="text" 
                        value={time}
                        onChange={(e) => setTime(e.target.value.toUpperCase())}
                        className="w-full bg-transparent border-b-2 border-emerald-950 px-0 py-4 text-3xl text-emerald-500 focus:outline-none focus:border-emerald-500 transition-all font-black placeholder:text-emerald-950 uppercase tracking-tighter"
                        placeholder="19:45"
                    />
                </div>
            </div>

            <button 
                onClick={onAnalyze}
                disabled={loading || !home || !away}
                className={`w-full mt-16 py-8 rounded-xl flex items-center justify-center gap-4 font-black tracking-[0.5em] text-sm transition-all ${
                    loading || !home || !away
                        ? 'bg-emerald-950/20 text-emerald-900 cursor-not-allowed border border-emerald-900/30'
                        : 'bg-emerald-600 text-black hover:bg-emerald-500 shadow-lg shadow-emerald-500/10 active:scale-[0.99]'
                }`}
            >
                {loading ? (
                    'RUNNING ANALYSIS...'
                ) : (
                    'COMMENCE ANALYSIS'
                )}
            </button>
        </div>
    );
};
