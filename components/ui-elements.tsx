import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Check, AlertTriangle, Info, X, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { NotificationType, Task } from '../types';
import { parseLocalDate } from '../utils';

export const CustomTimeSelect = ({ value, onChange, options, isDark, disabled, placeholder }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                const target = value || '08:00';
                const el = document.getElementById(`time-opt-${target}`);
                el?.scrollIntoView({ block: 'center' });
            }, 10);
        }
    }, [isOpen, value]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`text-xs font-mono font-bold py-1.5 px-3 rounded-lg min-w-[70px] text-center transition-all flex items-center justify-between gap-2 border ${disabled ? 'opacity-40 cursor-not-allowed border-transparent' :
                    isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                    }`}
            >
                <span>{value || placeholder || '--:--'}</span>
                {!disabled && <ChevronDown size={10} className="opacity-50" />}
            </button>
            {isOpen && (
                <div className={`absolute top-full left-0 mt-1 w-full min-w-[90px] max-h-48 overflow-y-auto custom-scrollbar rounded-lg shadow-xl border z-50 flex flex-col animate-in fade-in zoom-in-95 ${isDark ? 'bg-[#1e1e20] border-zinc-700' : 'bg-white border-gray-200'
                    }`}>
                    {!value && <button onClick={() => { onChange(""); setIsOpen(false) }} className={`text-xs font-mono py-2 px-2 text-center hover:bg-red-500/10 hover:text-red-500 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Limpiar</button>}
                    {options.map((opt: string) => (
                        <button
                            key={opt}
                            id={`time-opt-${opt}`}
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                            className={`text-xs font-mono py-2 px-2 w-full text-center transition-colors ${value === opt ? 'bg-emerald-500 text-white font-bold' : isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const CustomSelect = ({ value, onChange, options, isDark, placeholder, icon: Icon }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find((o: any) => o.value === value)?.label || placeholder || value;

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-2">
                    {Icon && <Icon size={14} className="opacity-70" />}
                    <span className="truncate">{selectedLabel}</span>
                </div>
                <ChevronDown size={12} className="opacity-50 flex-shrink-0" />
            </button>
            {isOpen && (
                <div className={`absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto custom-scrollbar rounded-lg shadow-xl border z-50 py-1 animate-in fade-in zoom-in-95 ${isDark ? 'bg-[#1e1e20] border-zinc-700' : 'bg-white border-gray-200'}`}>
                    {options.map((opt: any) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${value === opt.value ? 'bg-emerald-500/10 text-emerald-500 font-bold' : isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const NotificationToast = ({ notification, onClose }: { notification: NotificationType | null, onClose: () => void }) => {
    if (!notification) return null;
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [notification, onClose]);
    const bgColors = { success: 'bg-emerald-600 border-emerald-500', error: 'bg-red-600 border-red-500', info: 'bg-blue-600 border-blue-500', warning: 'bg-amber-600 border-amber-500' };
    return (
        <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white animate-in slide-in-from-top-5 duration-300 border ${bgColors[notification.type] || 'bg-zinc-800'}`}>
            {notification.type === 'success' && <Check size={20} />}
            {notification.type === 'error' && <AlertTriangle size={20} />}
            {notification.type === 'info' && <Info size={20} />}
            <span className="text-sm font-semibold">{notification.message}</span>
            <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100 bg-white/10 p-1 rounded-full"><X size={14} /></button>
        </div>
    );
};

export const MiniCalendar = ({ isDark, tasks, selectedDate, onSelectDate }: any) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysWithTasks = useMemo(() => {
        const daysSet = new Set();
        tasks.forEach((t: Task) => { if (!t.completed && t.dueDate) { const tDate = parseLocalDate(t.dueDate); if (tDate && tDate.getMonth() === month && tDate.getFullYear() === year) { daysSet.add(tDate.getDate()); } } });
        return daysSet;
    }, [tasks, month, year]);

    const handleDateClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onSelectDate(selectedDate === dateStr ? null : dateStr);
    };

    const renderDays = () => {
        const days = []; const today = new Date();
        for (let i = 0; i < firstDayIndex; i++) days.push(<div key={`empty-${i}`} className="h-7" />);
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            const hasTask = daysWithTasks.has(d);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;
            days.push(
                <div key={d} className="h-7 flex flex-col items-center justify-center relative cursor-pointer" onClick={() => handleDateClick(d)}>
                    <div className={`w-7 h-7 flex items-center justify-center text-xs rounded-full z-10 transition-all ${isSelected ? 'bg-emerald-500 text-white font-bold' : isToday ? 'bg-zinc-200 text-zinc-900 font-bold dark:bg-zinc-700 dark:text-white' : isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'}`}>{d}</div>
                    {hasTask && !isSelected && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />}
                </div>
            );
        }
        return days;
    };
    return (
        <div className={`p-4 rounded-2xl border mb-6 transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4"><span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span><div className="flex gap-1"><button onClick={prevMonth} className={`p-1 rounded-md ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-400'}`}><ChevronLeft size={14} /></button><button onClick={nextMonth} className={`p-1 rounded-md ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-400'}`}><ChevronRight size={14} /></button></div></div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">{daysOfWeek.map(d => <span key={d} className={`text-[10px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1 text-center">{renderDays()}</div>
        </div>
    );
};

import { PRODUCTIVITY_QUOTES } from '../quotes';

export const DailyQuoteWidget = ({ isDark, activeProjectId }: any) => {
    const [quoteObj, setQuoteObj] = useState(PRODUCTIVITY_QUOTES[0]);

    // Pick a new random quote whenever the active project changes or on mount
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * PRODUCTIVITY_QUOTES.length);
        setQuoteObj(PRODUCTIVITY_QUOTES[randomIndex]);
    }, [activeProjectId]);

    return (
        <div className={`p-5 rounded-2xl border mt-4 mb-6 transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex flex-col gap-3 relative">
                <Quote
                    size={24}
                    className={`absolute -top-1 -left-1 opacity-20 ${isDark ? 'text-zinc-500' : 'text-gray-300'}`}
                />
                <p className={`text-sm italic font-medium leading-relaxed my-2 pl-4 border-l-2 ${isDark ? 'text-zinc-300 border-emerald-500/50' : 'text-gray-700 border-emerald-400'}`}>
                    "{quoteObj.quote}"
                </p>
                <div className="flex items-center gap-2 justify-end mt-1">
                    <span className={`w-4 h-[1px] ${isDark ? 'bg-zinc-600' : 'bg-gray-300'}`} />
                    <span className={`text-[#10b981] font-bold text-xs tracking-wider uppercase`}>
                        {quoteObj.author}
                    </span>
                </div>
            </div>
        </div>
    );
};