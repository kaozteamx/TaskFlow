import React, { useState, useEffect, useRef } from 'react';
import { Timer, Coffee, Settings, X, Pause, Play, Square } from 'lucide-react';
import { ALARM_SOUNDS, workerCode } from '../utils';

export const PomodoroTimer = ({ isDark, isSidebarExpanded, onFocusComplete }: any) => {
    const DEFAULT_FOCUS = 52;
    const DEFAULT_BREAK = 17;
    const [timeLeft, setTimeLeft] = useState(DEFAULT_FOCUS * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('focus');
    const [showSettings, setShowSettings] = useState(false);
    const [customFocus, setCustomFocus] = useState(DEFAULT_FOCUS);
    const [customBreak, setCustomBreak] = useState(DEFAULT_BREAK);
    const [selectedSound, setSelectedSound] = useState('bell'); 
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const onFocusCompleteRef = useRef(onFocusComplete);
    const workerRef = useRef<Worker | null>(null);
    const endTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));
        workerRef.current = worker;
        worker.onmessage = (e) => { if (e.data === 'tick') setTimeLeft(prev => prev - 1); };
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        if (isActive) {
            workerRef.current?.postMessage('start');
            if (!endTimeRef.current) endTimeRef.current = Date.now() + timeLeft * 1000;
        } else {
            workerRef.current?.postMessage('stop');
            endTimeRef.current = null;
        }
    }, [isActive]);

    useEffect(() => { if (audioPlayerRef.current) { audioPlayerRef.current.src = ALARM_SOUNDS[selectedSound].url; audioPlayerRef.current.load(); } }, [selectedSound]);

    useEffect(() => { onFocusCompleteRef.current = onFocusComplete; }, [onFocusComplete]);

    useEffect(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        document.title = isActive ? `(${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}) TaskFlow` : "TaskFlow";
        return () => { document.title = "TaskFlow"; };
    }, [timeLeft, isActive]);

    useEffect(() => {
        if (isActive && endTimeRef.current) {
            const now = Date.now();
            const diff = Math.ceil((endTimeRef.current - now) / 1000);
            if (Math.abs(diff - timeLeft) > 1) setTimeLeft(diff > 0 ? diff : 0);
        }
    }, [timeLeft, isActive]);

    useEffect(() => {
        if (timeLeft <= 0 && isActive) {
            setIsActive(false); 
            if (audioPlayerRef.current) { audioPlayerRef.current.volume = 1.0; audioPlayerRef.current.currentTime = 0; audioPlayerRef.current.play().catch(() => {}); }
            if ("Notification" in window && Notification.permission === "granted") try { new Notification("TaskFlow", { body: mode === 'focus' ? "¡Tiempo de enfoque terminado!" : "¡Descanso terminado!", icon: '/favicon.ico' }); } catch (e) {}
            if (mode === 'focus') {
                if (onFocusCompleteRef.current) onFocusCompleteRef.current(customFocus);
                setMode('break');
                setTimeLeft(customBreak * 60);
                setTimeout(() => setIsActive(true), 100); 
            } else {
                setMode('focus');
                setTimeLeft(customFocus * 60);
            }
        }
    }, [timeLeft, isActive, mode, customBreak, customFocus]);

    const toggleTimer = () => {
        if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
        if (timeLeft === 0) { setTimeLeft(mode === 'focus' ? customFocus * 60 : customBreak * 60); setIsActive(true); } else { setIsActive(!isActive); }
    };
    
    const resetTimer = () => {
        // If manually stopped during focus, save the elapsed time
        if (mode === 'focus' && timeLeft < customFocus * 60) {
            const elapsedSeconds = (customFocus * 60) - timeLeft;
            // Use Math.ceil so even partial minutes count when stopped manually
            const minutesLogged = Math.ceil(elapsedSeconds / 60);
            if (minutesLogged > 0 && onFocusCompleteRef.current) {
                onFocusCompleteRef.current(minutesLogged);
            }
        }
        setIsActive(false); 
        setMode('focus'); 
        setTimeLeft(customFocus * 60);
    };

    const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };

    const saveSettings = (e: any) => {
        e.preventDefault();
        setShowSettings(false);
        const f = Math.max(1, Number(customFocus));
        const b = Math.max(1, Number(customBreak));
        setCustomFocus(f); setCustomBreak(b);
        if (!isActive) setTimeLeft(mode === 'focus' ? f * 60 : b * 60);
    };

    if (showSettings) return (
        <div className={`mb-4 mx-4 p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-center mb-3"><span className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Ajustes</span><button onClick={() => setShowSettings(false)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}><X size={14}/></button></div>
            <form onSubmit={saveSettings} className="space-y-3">
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Focus (min)</label><input type="number" min="1" value={customFocus} onChange={e => setCustomFocus(Number(e.target.value))} className={`w-full px-2 py-1 rounded text-sm outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`} /></div>
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Descanso (min)</label><input type="number" min="1" value={customBreak} onChange={e => setCustomBreak(Number(e.target.value))} className={`w-full px-2 py-1 rounded text-sm outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`} /></div>
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Sonido</label><select value={selectedSound} onChange={e => setSelectedSound(e.target.value)} className={`w-full px-2 py-1.5 rounded text-sm outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`}>{Object.entries(ALARM_SOUNDS).map(([key, sound]) => (<option key={key} value={key}>{sound.name}</option>))}</select></div>
                <button type="submit" className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Guardar</button>
            </form>
        </div>
    );

    if (!isSidebarExpanded) return (<div className={`mx-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isActive ? 'bg-emerald-500/20 text-emerald-500' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}`} onClick={toggleTimer} title={isActive ? "Pausar" : "Iniciar"}>{isActive ? <Pause size={16} /> : <Timer size={16} />}</div>);

    return (
        <>
            <div className={`mx-4 mb-4 p-3 rounded-xl border transition-all ${isActive ? isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50' : isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5">{mode === 'focus' ? <Timer size={14} className={isActive ? 'text-emerald-500' : isDark ? 'text-zinc-500' : 'text-gray-400'} /> : <Coffee size={14} className="text-amber-500" />}<span className={`text-[10px] font-bold uppercase tracking-wide ${mode === 'break' ? 'text-amber-500' : isActive ? 'text-emerald-500' : isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{mode === 'focus' ? 'Focus' : 'Descanso'}</span></div>
                    <button type="button" onClick={() => setShowSettings(true)} className={`p-1 rounded transition-colors ${isDark ? 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}><Settings size={12} /></button>
                </div>
                <div className={`text-2xl font-mono font-bold text-center my-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{formatTime(timeLeft)}</div>
                <div className="flex justify-center gap-2 mt-2">
                    <button onClick={toggleTimer} className={`p-1.5 rounded-lg transition-colors flex-1 flex justify-center ${isActive ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}>{isActive ? <Pause size={16} /> : <Play size={16} />}</button>
                    <button onClick={resetTimer} className={`p-1.5 rounded-lg transition-colors flex-1 flex justify-center ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-gray-400 hover:bg-gray-200 border border-gray-200'}`} title="Detener y guardar"><Square size={16} /></button>
                </div>
            </div>
            <audio ref={audioPlayerRef} preload="auto" src={ALARM_SOUNDS[selectedSound].url} />
        </>
    );
};