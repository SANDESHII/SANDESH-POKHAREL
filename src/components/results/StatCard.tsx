
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    isOver?: boolean;
    purity?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon: Icon, isOver = true, purity }) => {
    const isHighFidelity = purity !== undefined && purity >= 95;
    const isLowPurity = purity !== undefined && purity < 40;
    const theme = isOver ? 'blue' : 'emerald';
    
    return (
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between space-y-4 group transition-colors hover:border-zinc-800">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
                <Icon className={`w-4 h-4 text-${theme}-500`} />
            </div>
            <div className="space-y-1">
                <h4 className="text-3xl font-black text-white">{value}</h4>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest">{subValue}</p>
                    {isHighFidelity && (
                        <span className="text-[8px] font-black text-emerald-500/80 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 uppercase tracking-widest">High-Fidelity</span>
                    )}
                    {isLowPurity && (
                        <span className="text-[8px] font-black text-amber-500/50 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10 uppercase tracking-widest">Baseline Estimate</span>
                    )}
                </div>
            </div>
        </div>
    );
};
