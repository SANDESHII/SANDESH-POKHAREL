
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
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
                >
                    <div className="max-w-md w-full px-8 text-center space-y-8">
                        <div className="relative">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                className="w-32 h-32 mx-auto rounded-full border-2 border-slate-800 border-t-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.2)]"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Shield className="w-12 h-12 text-blue-500 animate-pulse" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <motion.h3 
                                key={stage}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-sm font-bold text-white uppercase tracking-[0.3em] font-mono h-6"
                            >
                                {messages[stage]}
                            </motion.h3>
                            
                            <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-blue-600"
                                    initial={{ width: "0%" }}
                                    animate={{ width: `${((stage + 1) / messages.length) * 100}%` }}
                                />
                            </div>

                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest animate-pulse">
                                Do not refresh terminal. Forensics in progress.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
