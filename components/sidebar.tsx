import React from 'react';
import { 
  Layout, Plus, FolderOpen, Edit2, Trash2, CloudCog, Download, Upload, 
  Loader2, SidebarClose, SidebarOpen, Sun, Moon, FileSpreadsheet, Home,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { Project } from '../types';
import { HOME_VIEW } from '../utils';
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
}

export const Sidebar = ({
    isSidebarExpanded, setIsSidebarExpanded, isDark, setIsDark,
    activeProject, setActiveProject, projects, isProjectsExpanded, setIsProjectsExpanded,
    openProjectModal, handleDeleteProject, setIsCloudSyncModalOpen,
    isImporting, isExportingCSV, handleExportPomodoroCSV, isBackingUp, handleExportData,
    fileInputRef, handleFileSelect, onFocusComplete
}: SidebarProps) => {
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
                             {projects.filter(p => p.id !== HOME_VIEW.id).map(p => (
                                 <div key={p.id} className="group relative">
                                     <button onClick={() => setActiveProject(p)} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${activeProject.id === p.id ? 'bg-emerald-600/10 text-emerald-500' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                                         <FolderOpen size={18} className={activeProject.id === p.id ? 'fill-emerald-600/20' : ''} />
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
                             ))}
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