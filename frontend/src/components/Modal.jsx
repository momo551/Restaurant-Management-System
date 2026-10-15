import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
            <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl mx-auto my-6 z-50">
                <div className="relative flex flex-col w-full bg-white border-0 rounded-2xl shadow-lg outline-none focus:outline-none">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200 rounded-t">
                        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                        <button
                            className="p-1 ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                            onClick={onClose}
                        >
                            <X size={24} />
                        </button>
                    </div>
                    {/* Body */}
                    <div className="relative p-6 flex-auto max-h-[70vh] overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
