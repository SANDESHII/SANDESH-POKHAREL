
import React from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
    status: {
        depth: number;
        isCoolingDown: boolean;
        cooldownRemaining: number;
        message: string;
    };
}

export const Header: React.FC<HeaderProps> = ({ status }) => {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">MATCH FORTRESS <span className="text-blue-500 italic">PRO</span></h1>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Institutional Forensic Terminal</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-4 text-xs font-mono">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <span className="text-slate-400">ENGINE: OPTIMAL</span>
                        </div>
                        <div className="w-px h-4 bg-slate-800" />
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">QUEUE:</span>
                            <span className={status.depth > 0 ? "text-blue-400 font-bold" : "text-slate-400"}>
                                {status.depth} TASKS
                            </span>
                        </div>
                        {status.isCoolingDown && (
                            <>
                                <div className="w-px h-4 bg-slate-800" />
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                    <span className="text-orange-400 font-bold uppercase">THROTTLED: {status.cooldownRemaining}S</span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="px-3 py-1 bg-slate-800 rounded border border-slate-700">
                        <span className="text-[10px] font-mono text-slate-400">SESSION: <span className="text-white">AK-744</span></span>
                    </div>
                </div>
            </div>
        </header>
    );
};
