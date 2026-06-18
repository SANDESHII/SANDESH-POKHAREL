
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    color?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon: Icon, color = 'blue' }) => {
    const colorClasses = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20 shadow-purple-500/5',
        green: 'text-green-500 bg-green-500/10 border-green-500/20 shadow-green-500/5',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-orange-500/5',
        red: 'text-red-500 bg-red-500/10 border-red-500/20 shadow-red-500/5',
    };

    return (
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 hover:border-slate-800 transition-all group overflow-hidden relative">
            <div className="flex items-center gap-3 relative z-10">
                <div className={`p-2 rounded-lg border ${colorClasses[color]} transition-transform group-hover:scale-110`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{label}</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-xl font-bold tracking-tight text-white">{value}</span>
                        {subValue && <span className="text-xs font-mono text-slate-500">{subValue}</span>}
                    </div>
                </div>
            </div>
            {/* Subtle mesh background element */}
            <div className={`absolute -right-2 -bottom-2 w-16 h-16 blur-2xl rounded-full opacity-0 group-hover:opacity-20 transition-opacity ${
                color === 'blue' ? 'bg-blue-600' : 
                color === 'purple' ? 'bg-purple-600' : 
                color === 'green' ? 'bg-green-600' : 
                color === 'orange' ? 'bg-orange-600' : 'bg-red-600'
            }`} />
        </div>
    );
};
