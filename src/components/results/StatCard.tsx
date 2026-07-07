
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: LucideIcon;
    isOver?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, icon: Icon, isOver = true }) => {
    return (
        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between space-y-4 group transition-colors hover:border-zinc-800">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
                <Icon className={`w-4 h-4 ${isOver ? 'text-blue-500' : 'text-emerald-500'}`} />
            </div>
            <div className="space-y-1">
                <h4 className="text-3xl font-black text-white">{value}</h4>
                <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest">{subValue}</p>
            </div>
        </div>
    );
};
