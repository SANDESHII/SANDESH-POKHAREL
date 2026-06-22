
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    color?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon: Icon, color = 'green' }) => {
    const colorClasses = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        green: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        red: 'text-red-500 bg-red-500/10 border-red-500/20',
    };

    return (
        <div className="bg-zinc-950 p-6 rounded-2xl border border-emerald-900/30 hover:border-emerald-500 transition-all group overflow-hidden relative shadow-2xl">
            <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-xl border-2 ${colorClasses[color]} transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">{label}</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black tracking-tighter text-white">{value}</span>
                        {subValue && <span className="text-[10px] font-black text-zinc-700 tracking-wider uppercase">{subValue}</span>}
                    </div>
                </div>
            </div>
            {/* Subtle mesh background element */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 blur-3xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity ${
                color === 'blue' ? 'bg-blue-600/20' : 
                color === 'purple' ? 'bg-purple-600/20' : 
                color === 'green' ? 'bg-emerald-600/20' : 
                color === 'orange' ? 'bg-orange-600/20' : 'bg-red-600/20'
            }`} />
        </div>
    );
};
