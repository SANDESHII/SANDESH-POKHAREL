
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';

interface LoadingOverlayProps {
    loading: boolean;
    stage: number;
    messages: string[];
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ loading, stage, messages }) => {
    return (
        <AnimatePresence>
            {loading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md"
                >
                    <div className="max-w-md w-full px-8 text-center space-y-12">
                        <div className="relative">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                className="w-32 h-32 mx-auto rounded-full border-2 border-emerald-950 border-t-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.1)]"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Shield className="w-12 h-12 text-emerald-500 animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-8">
                            <motion.h3 
                                key={stage}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-xs font-black text-emerald-500 uppercase tracking-[0.4em] h-8"
                            >
                                {messages[stage]}
                            </motion.h3>
                            
                            <div className="w-full h-1 bg-emerald-950 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                    initial={{ width: "0%" }}
                                    animate={{ width: `${((stage + 1) / messages.length) * 100}%` }}
                                />
                            </div>

                            <p className="text-[10px] text-emerald-900 font-black uppercase tracking-[0.3em] animate-pulse">
                                SYSTEM SYNCHRONIZING. PLEASE STAND BY.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
