
import React from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
    status: {
        depth: number;
        isCoolingDown: boolean;
        cooldownRemaining: number;
        message: string;
        systemPressure?: number;
    };
}

export const Header: React.FC<HeaderProps> = ({ status }) => {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-emerald-900/20 px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <h1 className="text-sm font-black tracking-[0.2em] text-white">FORTRESS <span className="text-emerald-500">PRO</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    {status.systemPressure !== undefined && (
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-900 uppercase">Load:</span>
                            <div className="flex gap-1">
                                {[...Array(10)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-1 h-3 rounded-full ${i < (status.systemPressure || 0) ? 'bg-emerald-500 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'bg-emerald-950'}`} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-emerald-950/20 rounded-full border border-emerald-900/30">
                        {status.depth > 0 && <span className="text-[10px] font-black text-emerald-500 mr-2">QUEUE: {status.depth}</span>}
                        <div className={`w-2 h-2 rounded-full ${status.isCoolingDown ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">{status.isCoolingDown ? `${status.cooldownRemaining}S COOLDOWN` : 'SYSTEM READY'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
};
