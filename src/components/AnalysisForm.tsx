
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
        <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1 flex items-center gap-2">
                        <Trophy className="w-3 h-3" /> Home Command
                    </label>
                    <div className="relative group">
                        <input 
                            type="text" 
                            value={home}
                            onChange={(e) => setHome(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-700"
                            placeholder="MANCHESTER CITY"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1 flex items-center gap-2">
                        <Trophy className="w-3 h-3" /> Away Resistance
                    </label>
                    <div className="relative group">
                        <input 
                            type="text" 
                            value={away}
                            onChange={(e) => setAway(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-700"
                            placeholder="LIVERPOOL"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1 flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> Sector (League)
                    </label>
                    <div className="relative group">
                        <input 
                            type="text" 
                            value={league}
                            onChange={(e) => setLeague(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-700"
                            placeholder="PREMIER LEAGUE"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1 flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Kickoff Sync
                    </label>
                    <div className="relative group">
                        <input 
                            type="text" 
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-700 font-mono text-sm"
                            placeholder="TODAY 15:00"
                        />
                    </div>
                </div>
            </div>

            <button 
                onClick={onAnalyze}
                disabled={loading || !home || !away}
                className={`w-full mt-8 py-4 rounded-xl flex items-center justify-center gap-3 font-bold tracking-widest text-sm transition-all shadow-lg ${
                    loading || !home || !away
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-500 hover:to-indigo-600 active:scale-[0.98] shadow-blue-900/20'
                }`}
            >
                {loading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ENGAGING FORENSIC AUDIT...
                    </>
                ) : (
                    <>
                        <Search className="w-4 h-4" />
                        COMMENCE ANALYSIS
                    </>
                )}
            </button>
        </div>
    );
};
