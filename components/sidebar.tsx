import React, { useState, useRef, useEffect } from 'react';
import { 
  Layout, Plus, FolderOpen, Edit2, Trash2, CloudCog, Download, Upload, 
  Loader2, SidebarClose, SidebarOpen, Sun, Moon, FileSpreadsheet, Home,
  ChevronDown, ChevronRight, Waves
} from 'lucide-react';
import { Project } from '../types';
import { HOME_VIEW, PROJECT_COLORS } from '../utils';
import { PomodoroTimer } from './pomodoro-timer';

interface SidebarProps {
    isSidebarExpanded: boolean;
    setIsSidebarExpanded: (v: boolean) => void;
    isDark: boolean;
    setIsDark: (v: boolean) => void;
    activeProject: Project;
    setActiveProject: (p: Project) => void;
    projects: Project[];
    isProjectsExpanded: boolean;
    setIsProjectsExpanded: (v: boolean) => void;
    openProjectModal: (p: Project | null) => void;
    handleDeleteProject: (p: Project) => void;
    setIsCloudSyncModalOpen: (v: boolean) => void;
    isImporting: boolean;
    isExportingCSV: boolean;
    handleExportPomodoroCSV: () => void;
    isBackingUp: boolean;
    handleExportData: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileSelect: (e: any) => void;
    onFocusComplete: (minutes: number) => void;
    onMoveTaskToProject: (taskId: string, projectId: string) => void;
}

export const Sidebar = ({
    isSidebarExpanded, setIsSidebarExpanded, isDark, setIsDark,
    activeProject, setActiveProject, projects, isProjectsExpanded, setIsProjectsExpanded,
    openProjectModal, handleDeleteProject, setIsCloudSyncModalOpen,
    isImporting, isExportingCSV, handleExportPomodoroCSV, isBackingUp, handleExportData,
    fileInputRef, handleFileSelect, onFocusComplete, onMoveTaskToProject
}: SidebarProps) => {
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
    const [isNoisePlaying, setIsNoisePlaying] = useState(false);
    
    // Web Audio API refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);

    const handleDragOver = (e: React.DragEvent, projectId: string) => {
        e.preventDefault();
        setDragOverProjectId(projectId);
    };

    const handleDragLeave = () => {
        setDragOverProjectId(null);
    };

    const handleDrop = (e: React.DragEvent, projectId: string) => {
        e.preventDefault();
        setDragOverProjectId(null);
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            onMoveTaskToProject(taskId, projectId);
        }
    };

    // Clean up audio on unmount
    useEffect(() => {
        return () => {
            if (sourceNodeRef.current) sourceNodeRef.current.stop();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const toggleNoise = () => {
        if (isNoisePlaying) {
            // Stop Audio
            if (gainNodeRef.current) {
                // Fade out to prevent popping
                const currentTime = audioContextRef.current?.currentTime || 0;
                gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.5);
                setTimeout(() => {
                    if (sourceNodeRef.current) {
                        sourceNodeRef.current.stop();
                        sourceNodeRef.current = null;
                    }
                    setIsNoisePlaying(false);
                }, 500);
            } else {
                 if (sourceNodeRef.current) sourceNodeRef.current.stop();
                 setIsNoisePlaying(false);
            }
        } else {
            // Start Audio
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContextClass();
                }
                const ctx = audioContextRef.current;
                
                // Resume context if suspended (browser policy)
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }

                // 1. Generate Pink Noise Buffer (Paul Kellett's method)
                const bufferSize = ctx.sampleRate * 4; // 4 seconds loop for better variety
                const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                
                let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                    output[i] *= 0.11; // Compensate for gain
                    b6 = white * 0.115926;
                }
                
                const noiseSource = ctx.createBufferSource();
                noiseSource.buffer = noiseBuffer;
                noiseSource.loop = true;

                // 2. Create "Warmth" Filter (LowPass)
                // Cuts off harsh high frequencies to make it "warm"
                const warmFilter = ctx.createBiquadFilter();
                warmFilter.type = 'lowpass';
                warmFilter.frequency.value = 3500; // Soften anything above 3.5kHz
                warmFilter.Q.value = 0.5;

                // 3. Create "432Hz Boost" Filter (Peaking)
                // Adds resonant energy specifically at 432Hz
                const boostFilter = ctx.createBiquadFilter();
                boostFilter.type = 'peaking';
                boostFilter.frequency.value = 432;
                boostFilter.Q.value = 1.0; // Width of the boost (1.0 is fairly broad and musical)
                boostFilter.gain.value = 12; // Significant boost (+12dB) at this frequency

                // 4. Gain Node (Volume)
                const gainNode = ctx.createGain();
                gainNode.gain.value = 0.1; // Reduced slightly to account for the boost filter
                
                // Connect the Graph: Source -> Boost -> Warmth -> Gain -> Out
                noiseSource.connect(boostFilter);
                boostFilter.connect(warmFilter);
                warmFilter.connect(gainNode);
                gainNode.connect(ctx.destination);
                
                noiseSource.start();
                
                // Fade in
                gainNode.gain.setValueAtTime(0, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1);

                sourceNodeRef.current = noiseSource;
                gainNodeRef.current = gainNode;
                setIsNoisePlaying(true);
            } catch (e) {
                console.error("Audio generation failed", e);
            }
        }
    };

    return (
        <div className={`flex flex-col border-r transition-all duration-300 flex-shrink-0 ${isSidebarExpanded ? 'w-64' : 'w-16'} ${isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="p-4 flex flex-col gap-6">
                <div className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white">
                            <Layout size={18} />
                        </div>
                        {isSidebarExpanded && <span className="font-semibold">TaskFlow</span>}
                    </div>
                    <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}>
                        {isSidebarExpanded ? <SidebarClose size={18}/> : <SidebarOpen size={18}/>}
                    </button>
                </div>
                
                {/* POMODORO TIMER */}
                <PomodoroTimer isDark={isDark} isSidebarExpanded={isSidebarExpanded} onFocusComplete={onFocusComplete} />

                <div className="flex flex-col gap-1">
                    <button onClick={() => { setActiveProject(HOME_VIEW); }} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${activeProject.id === HOME_VIEW.id ? 'bg-emerald-600/10 text-emerald-500' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                        <Home size={20} />
                        {isSidebarExpanded && <span className="text-sm font-medium">Inicio</span>}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                     {isSidebarExpanded && (
                        <div className="flex items-center justify-between px-2 mb-2 group">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Proyectos</span>
                                {isProjectsExpanded ? <ChevronDown size={14} className="opacity-50"/> : <ChevronRight size={14} className="opacity-50"/>}
                            </div>
                            <button onClick={() => openProjectModal(null)} className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`} title="Nuevo Proyecto">
                                <Plus size={14} />
                            </button>
                        </div>
                     )}
                     {(isSidebarExpanded ? isProjectsExpanded : true) && (
                         <div className="space-y-0.5">
                             {projects.filter(p => p.id !== HOME_VIEW.id).map(p => {
                                 const colorDot = PROJECT_COLORS[p.color || 'gray']?.dot || 'bg-zinc-400';
                                 const isHovered = dragOverProjectId === p.id;
                                 
                                 return (
                                 <div 
                                    key={p.id} 
                                    className="group relative"
                                    onDragOver={(e) => handleDragOver(e, p.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, p.id)}
                                 >
                                     <button onClick={() => setActiveProject(p)} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isHovered ? 'bg-emerald-500/20 border border-emerald-500/50' : activeProject.id === p.id ? 'bg-emerald-600/10 text-emerald-500' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                                         {/* Use color dot instead of generic folder icon if collapsed, or just next to name */}
                                         <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorDot}`} />
                                         {isSidebarExpanded && <span className="text-sm truncate pr-12">{p.name}</span>}
                                     </button>
                                     {isSidebarExpanded && (
                                         <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={(e) => { e.stopPropagation(); openProjectModal(p); }} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-black hover:bg-gray-300'}`}>
                                                 <Edit2 size={12} />
                                             </button>
                                             <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p); }} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
                                                 <Trash2 size={12} />
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             )})}
                         </div>
                     )}
                </div>
            </div>

            <div className={`p-4 mt-auto border-t flex flex-col gap-2 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                {/* CLOUD / BACKUP / THEME CONTROLS */}
                <div className={`flex gap-1 justify-center ${!isSidebarExpanded && 'flex-col'}`}>
                    <button onClick={() => setIsCloudSyncModalOpen(true)} className={`flex items-center justify-center p-2 rounded-lg transition-all ${isDark ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title="Sincronización Nube"><CloudCog size={18} /></button>
                    {isImporting ? (<div className="flex justify-center p-2"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>) : (
                        <>
                            <button onClick={toggleNoise} className={`flex items-center justify-center p-2 rounded-lg transition-all ${isNoisePlaying ? 'bg-rose-500/20 text-rose-500 animate-pulse' : isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title={isNoisePlaying ? "Detener Ruido Rosa (432Hz)" : "Reproducir Ruido Rosa (432Hz Focus)"}><Waves size={18} /></button>
                            <button onClick={handleExportPomodoroCSV} disabled={isExportingCSV} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Reporte CSV Pomodoros">{isExportingCSV ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}</button>
                            <button onClick={handleExportData} disabled={isBackingUp} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Descargar Backup">{isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}</button>
                            <label className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Restaurar Backup"><Upload size={18} /><input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileSelect} /></label>
                        </>
                    )}
                </div>
                <button onClick={() => setIsDark(!isDark)} className={`w-full flex items-center justify-center gap-3 p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
       </div>
    );
};