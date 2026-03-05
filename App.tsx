import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
    Plus, Loader2, Calendar as CalendarIcon,
    List, BarChart3, Search, FilterX, StickyNote, Flag, ExternalLink, Clock, LogOut, Layout,
    AlertTriangle, Copy, Check, WifiOff, Link, ChevronUp, ChevronDown, ChevronRight, Kanban
} from 'lucide-react';

// --- Imports from Refactored Modules ---
import { auth, db, signInAnonymously, onAuthStateChanged, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch, getDocs, IS_DEMO, __app_id } from './firebase-setup';
import { Project, Task, NotificationType } from './types';
import {
    HOME_VIEW, safeDate, formatDate, calculateNextDueDate, calculateDuration, parseICS
} from './utils';

// --- Component Imports ---
import { NotificationToast, MiniCalendar, PerformanceChart } from './components/ui-elements';
import { ConfirmationModal, CloudSyncModal, PomodoroLogModal, ProjectModal, CalendarSubscribeModal } from './components/modals';
import { TaskNoteModal } from './components/task-note-modal';
import { CalendarBoard } from './components/calendar-board';
import { KanbanBoard } from './components/kanban-board';
import { TaskItem } from './components/task-item';
import { Sidebar } from './components/sidebar';
import { DetailsPanel } from './components/details-panel';

import { useAuth } from './hooks/useAuth';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './hooks/useTasks';
import { useCloudSync } from './hooks/useCloudSync';
import { useDashboard } from './hooks/useDashboard';
import { DashboardBoard } from './components/dashboard-board';

const App = () => {
    const [isDark, setIsDark] = useState(() => {
        const stored = localStorage.getItem('taskflow_theme');
        return stored ? stored === 'dark' : true;
    });
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'board' | 'dashboard'>(() => {
        const stored = localStorage.getItem('taskflow_viewMode');
        return (stored as 'list' | 'calendar' | 'board' | 'dashboard') || 'list';
    });

    useEffect(() => { localStorage.setItem('taskflow_theme', isDark ? 'dark' : 'light'); }, [isDark]);
    useEffect(() => { localStorage.setItem('taskflow_viewMode', viewMode); }, [viewMode]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<NotificationType | null>(null);
    const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false });

    // Auth 
    const {
        authUser, customUid, setCustomUid, authLoading, isLoggingIn,
        userId, getCollectionRef, handleLogin, handleSignOut
    } = useAuth(setNotification);

    const [tasks, setTasks] = useState<Task[]>([]);

    // Projects
    const {
        projects, activeProject, setActiveProject, isProjectModalOpen, setIsProjectModalOpen,
        editingProject, projectName, setProjectName, projectLinks, setProjectLinks, projectColor, setProjectColor,
        projectNotes, setProjectNotes, handleSaveNotes, openProjectModal, handleSaveProject, handleDeleteProject
    } = useProjects(userId, getCollectionRef, setNotification, setConfirmModal, tasks);

    // Tasks (requires tasks state mapped to its internal if we don't refactor everything deeply, but let's use the hook)
    const {
        tasks: fetchedTasks,
        editingTask, setEditingTask, handleUpdateNote, handleUpdateTask, handleUpdateTaskTime, handleUpdateTaskDetail,
        handleReparentTask, handleMoveTaskToProject, handleToggleTask, handleUpdateTaskStatus, handleKanbanQuickAdd,
        handleDeleteTask, handleToggleReview, handleQuickAddTask, handleAddSubtask, handleToggleTracking, handleResetTracking
    } = useTasks(userId, getCollectionRef, setNotification, setConfirmModal, projects, activeProject, setLoading);

    // Sync tasks up to the component for other features or map properly
    useEffect(() => {
        setTasks(fetchedTasks);
    }, [fetchedTasks]);

    const { pomodoroLogs } = useDashboard(userId, getCollectionRef);

    const {
        isCloudSyncModalOpen, setIsCloudSyncModalOpen, isBackingUp, isExportingCSV, isImporting, fileInputRef,
        handleActivateCloudMode, handleExportData, handleExportPomodoroCSV, handleFileSelect,
        handleSetCustomId, handleClearCustomId
    } = useCloudSync(authUser, userId, getCollectionRef, setNotification, setConfirmModal, projects, (id) => {
        setCustomUid(id);
        localStorage.setItem('taskflow_custom_uid', id);
        setIsCloudSyncModalOpen(false);
        setNotification({ type: 'success', message: 'Conectado a espacio compartido.' });
        setActiveProject(HOME_VIEW);
    }, () => {
        setCustomUid(null);
        localStorage.removeItem('taskflow_custom_uid');
        setIsCloudSyncModalOpen(false);
        setNotification({ type: 'info', message: 'Desconectado. Regresando a espacio privado.' });
        setActiveProject(HOME_VIEW);
    });

    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
    const [pomodoroLogModalOpen, setPomodoroLogModalOpen] = useState(false);
    const [completedFocusMinutes, setCompletedFocusMinutes] = useState(0);
    const [externalEvents, setExternalEvents] = useState<Task[]>([]);
    const [isCalendarSubscribeModalOpen, setIsCalendarSubscribeModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // List View States
    const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);
    const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
    const [sortBy, setSortBy] = useState('priority');
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [quickTaskTitle, setQuickTaskTitle] = useState('');
    const [checklistModalTask, setChecklistModalTask] = useState<Task | null>(null);
    const detailsPanelRef = useRef<HTMLDivElement>(null);

    const handleFocusComplete = useCallback((minutes: number) => { setCompletedFocusMinutes(minutes); setPomodoroLogModalOpen(true); }, []);
    const handleLogPomodoro = async (projectId: string) => {
        if (!projectId) return;
        try {
            await addDoc(getCollectionRef('pomodoro_logs'), { projectId, durationMinutes: completedFocusMinutes, createdAt: serverTimestamp() });
            setPomodoroLogModalOpen(false);
            setNotification({ type: 'success', message: 'Sesión registrada' });
        } catch (error) { console.error(error); }
    };

    const handleSubscribeCalendar = async (url: string) => {
        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("No se pudo conectar al calendario");
            const text = await response.text();
            const events = parseICS(text);
            setExternalEvents(events as Task[]);
            setIsCalendarSubscribeModalOpen(false);
            setNotification({ type: 'success', message: `Calendario sincronizado: ${events.length} eventos.` });
            setViewMode('calendar');
        } catch (e: any) {
            setNotification({ type: 'error', message: 'Error al importar: ' + e.message });
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (editingTask && detailsPanelRef.current && !detailsPanelRef.current.contains(event.target as Node)) {
                setEditingTask(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editingTask, setEditingTask]);

    const allTasks = useMemo(() => {
        if (externalEvents.length === 0) return tasks;
        return [...tasks, ...externalEvents];
    }, [tasks, externalEvents]);

    const activeRootTasks = useMemo(() => {
        let sourceTasks = viewMode === 'list' && activeProject.id !== HOME_VIEW.id ? tasks : allTasks;
        let filtered = sourceTasks.filter(t => !t.parentTaskId);

        if (activeProject.id !== HOME_VIEW.id) {
            filtered = filtered.filter(t => t.projectId === activeProject.id);
        }

        if (selectedDateFilter) {
            filtered = filtered.filter(t => t.dueDate === selectedDateFilter);
        }

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(t => t.title.toLowerCase().includes(lowerQuery));
        }

        return filtered.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (sortBy === 'priority') {
                const priorityScore: any = { high: 3, medium: 2, low: 1, none: 0 };
                const scoreA = priorityScore[a.priority || 'none'] || 0;
                const scoreB = priorityScore[b.priority || 'none'] || 0;
                if (scoreA !== scoreB) return scoreB - scoreA;
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
                return dateA - dateB;
            } else if (sortBy === 'date') {
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
                return dateA - dateB;
            } else if (sortBy === 'created') {
                return (safeDate(a.createdAt)?.getTime() || 0) - (safeDate(b.createdAt)?.getTime() || 0);
            }
            return 0;
        });
    }, [allTasks, activeProject, sortBy, selectedDateFilter, searchQuery, viewMode, tasks]);

    const currentTaskSubtasks = useMemo(() => {
        if (!editingTask) return [];
        return tasks.filter(t => t.parentTaskId === editingTask.id);
    }, [tasks, editingTask]);

    const completionRate = activeRootTasks.length > 0 ? Math.round((activeRootTasks.filter(t => t.completed).length / activeRootTasks.length) * 100) : 0;
    const completedTasks = useMemo(() => activeRootTasks.filter(t => t.completed), [activeRootTasks]);

    if (authLoading) return (
        <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50'}`}>
            <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
        </div>
    );

    // LOGIN SCREEN
    if (!authUser && !IS_DEMO) {
        const currentDomain = window.location.hostname;

        const handleCopyDomain = () => {
            navigator.clipboard.writeText(currentDomain);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <div className={`flex flex-col items-center justify-center h-screen w-full px-4 ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="w-full max-w-sm text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-900/40 text-white mx-auto mb-6">
                        <Layout size={32} />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Bienvenido a TaskFlow</h1>
                    <p className={`mb-8 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Organiza tus tareas, gestiona tu tiempo y sincroniza tus proyectos en la nube.
                    </p>

                    <button
                        onClick={handleLogin}
                        disabled={isLoggingIn}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />}
                        {isLoggingIn ? 'Iniciando sesión...' : 'Continuar con Google'}
                    </button>

                    {/* BUTTON TO BYPASS LOGIN (FORCE OFFLINE) */}
                    <button
                        onClick={() => { localStorage.setItem('taskflow_force_offline', 'true'); window.location.reload(); }}
                        className={`mt-3 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                        <WifiOff size={20} />
                        Usar Modo Offline
                    </button>

                    <p className={`mt-6 text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        Si no has configurado Firebase, la app funcionará en modo Demo local.
                    </p>

                    {/* DOMAIN AUTHORIZATION HELPER */}
                    <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left w-full">
                        <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} /> Configuración Requerida
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                            Para usar Google Login, debes autorizar este dominio en Firebase:
                        </p>
                        <div className="flex items-center gap-2 bg-white dark:bg-black/20 p-2 rounded border border-amber-500/10 mb-2">
                            <code className="text-xs font-mono flex-1 truncate select-all">{currentDomain}</code>
                            <button
                                onClick={handleCopyDomain}
                                className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-500 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                            >
                                {copied ? <Check size={10} /> : <Copy size={10} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                            Ve a <strong>Authentication &gt; Settings &gt; Authorized Domains</strong>. O usa el <strong>Modo Offline</strong>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // APP UI
    if (loading) return (
        <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50'}`}>
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
                <p className="text-sm opacity-50">Sincronizando con la nube...</p>
            </div>
        </div>
    );

    return (
        <div className={`flex h-screen w-full ${isDark ? 'dark bg-[#09090b] text-zinc-100' : 'bg-white text-gray-900'}`}>
            {/* MAIN SIDEBAR */}
            <Sidebar
                isSidebarExpanded={isSidebarExpanded}
                setIsSidebarExpanded={setIsSidebarExpanded}
                isDark={isDark}
                setIsDark={setIsDark}
                activeProject={activeProject}
                setActiveProject={setActiveProject}
                projects={projects}
                isProjectsExpanded={isProjectsExpanded}
                setIsProjectsExpanded={setIsProjectsExpanded}
                openProjectModal={openProjectModal}
                handleDeleteProject={handleDeleteProject}
                setIsCloudSyncModalOpen={setIsCloudSyncModalOpen}
                isImporting={isImporting}
                isExportingCSV={isExportingCSV}
                handleExportPomodoroCSV={handleExportPomodoroCSV}
                isBackingUp={isBackingUp}
                handleExportData={handleExportData}
                fileInputRef={fileInputRef}
                handleFileSelect={handleFileSelect}
                onFocusComplete={handleFocusComplete}
                onMoveTaskToProject={handleMoveTaskToProject}
                onOpenCalendarSubscribe={() => setIsCalendarSubscribeModalOpen(true)}
            />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Top Bar for View Switching */}
                <div className={`h-14 border-b flex items-center justify-between px-6 flex-shrink-0 ${isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                    <h1 className="text-lg font-bold truncate">
                        {activeProject.name}
                    </h1>

                    <div className="flex items-center gap-3">
                        {/* View Switcher */}
                        <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'list' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                            >
                                <List size={14} /> Lista
                            </button>
                            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                            <button
                                onClick={() => setViewMode('board')}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'board' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                            >
                                <Kanban size={14} /> Tablero
                            </button>
                            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'calendar' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                            >
                                <CalendarIcon size={14} /> Calendario
                            </button>
                            <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                            <button
                                onClick={() => setViewMode('dashboard')}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'dashboard' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                            >
                                <BarChart3 size={14} /> Estadísticas
                            </button>
                        </div>

                        {/* User Profile / Logout */}
                        {authUser && (
                            <div className="flex items-center gap-2 border-l pl-3 ml-2 border-gray-200 dark:border-zinc-800">
                                {authUser.photoURL && (
                                    <img src={authUser.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
                                )}
                                <button onClick={handleSignOut} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/30 text-zinc-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`} title="Cerrar Sesión">
                                    <LogOut size={16} />
                                </button>
                            </div>
                        )}
                        {IS_DEMO && (
                            <div className="flex items-center gap-2 border-l pl-3 ml-2 border-gray-200 dark:border-zinc-800">
                                <button
                                    onClick={() => { localStorage.removeItem('taskflow_force_offline'); window.location.reload(); }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-400' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-600'}`}
                                >
                                    Conectar Cuenta
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTENT BODY */}
                {viewMode === 'list' ? (
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT PANEL (Project Details) */}
                        {activeProject ? (
                            <div className={`hidden lg:flex lg:w-80 border-r flex-col overflow-y-auto custom-scrollbar p-6 ${isDark ? 'border-zinc-800 bg-[#0c0c0e]' : 'border-gray-200 bg-gray-50'}`}>
                                {activeProject.links && activeProject.links.length > 0 && (
                                    <div className="mb-6">
                                        <button
                                            onClick={() => setIsResourcesExpanded(!isResourcesExpanded)}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-md ${isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    <Link size={14} />
                                                </div>
                                                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                                    Recursos ({activeProject.links.length})
                                                </span>
                                            </div>
                                            {isResourcesExpanded ? <ChevronUp size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'} /> : <ChevronDown size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />}
                                        </button>

                                        {isResourcesExpanded && (
                                            <div className={`mt-2 flex flex-col gap-1 p-1 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                                {activeProject.links.map((link, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-emerald-600'}`}
                                                    >
                                                        <span className="truncate">{link.name || 'Enlace sin nombre'}</span>
                                                        <ExternalLink size={12} className="opacity-50" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <MiniCalendar
                                    isDark={isDark}
                                    tasks={activeProject.id === HOME_VIEW.id ? tasks : tasks.filter(t => t.projectId === activeProject.id)}
                                    selectedDate={selectedDateFilter}
                                    onSelectDate={setSelectedDateFilter}
                                />
                                <PerformanceChart isDark={isDark} completionRate={completionRate} />

                                {/* QUICK NOTES */}
                                {activeProject.id !== HOME_VIEW.id && (
                                    <div className={`flex-1 flex flex-col p-4 rounded-2xl border min-h-[150px] transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800 focus-within:border-emerald-500/50' : 'bg-white border-gray-200 shadow-sm focus-within:border-emerald-400'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <StickyNote size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                                            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Notas Rápidas</h3>
                                        </div>
                                        <textarea
                                            className={`flex-1 w-full bg-transparent resize-none outline-none text-sm leading-relaxed custom-scrollbar ${isDark ? 'text-zinc-300 placeholder-zinc-700' : 'text-gray-700 placeholder-gray-300'}`}
                                            placeholder="Escribe aquí..."
                                            value={projectNotes}
                                            onChange={(e) => setProjectNotes(e.target.value)}
                                            onBlur={handleSaveNotes}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {/* RIGHT PANEL (Tasks) */}
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                        {selectedDateFilter ? `Tareas del ${formatDate(selectedDateFilter)}` : 'Todas las Tareas'}
                                    </h2>
                                    <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{activeRootTasks.length} tareas encontradas</span>
                                </div>

                                {/* Filters */}
                                <div className="flex items-center gap-2">
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all focus-within:border-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                        <Search size={16} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Buscar..."
                                            className={`bg-transparent border-none outline-none text-sm w-24 sm:w-32 ${isDark ? 'text-zinc-200 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`}
                                        />
                                    </div>
                                    <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                        <button onClick={() => setSortBy('priority')} className={`p-1.5 rounded-md transition-all ${sortBy === 'priority' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><Flag size={14} /></button>
                                        <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                        <button onClick={() => setSortBy('date')} className={`p-1.5 rounded-md transition-all ${sortBy === 'date' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><CalendarIcon size={14} /></button>
                                        <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                        <button onClick={() => setSortBy('created')} className={`p-1.5 rounded-md transition-all ${sortBy === 'created' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><Clock size={14} /></button>
                                    </div>
                                    {selectedDateFilter && (
                                        <button onClick={() => setSelectedDateFilter(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                                            <FilterX size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {activeProject.id !== HOME_VIEW.id && (
                                <form onSubmit={async (e) => {
                                    const success = await handleQuickAddTask(e, quickTaskTitle, selectedDateFilter);
                                    if (success) setQuickTaskTitle('');
                                }} className="mb-8">
                                    <div className={`flex items-center gap-3 p-4 rounded-xl border border-dashed transition-all cursor-text ${isDark ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30' : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/10'}`}>
                                        <Plus size={20} className={isDark ? 'text-zinc-600' : 'text-gray-400'} />
                                        <input type="text" value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} className={`bg-transparent border-none outline-none w-full text-[15px] ${isDark ? 'text-zinc-300 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`} placeholder="Añadir tarea..." />
                                    </div>
                                </form>
                            )}

                            <div className="space-y-2 pb-20">
                                {activeRootTasks.length === 0 && (
                                    <div className="text-center py-20 opacity-50 flex flex-col items-center">
                                        <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}><BarChart3 size={24} /></div>
                                        <p>No hay tareas que coincidan</p>
                                    </div>
                                )}
                                {activeRootTasks.filter(t => !t.completed).map(t => {
                                    const subtasks = tasks.filter(sub => sub.parentTaskId === t.id);
                                    const completedSubCount = subtasks.filter(sub => sub.completed).length;
                                    return (
                                        <TaskItem
                                            key={t.id}
                                            task={t}
                                            onToggle={handleToggleTask}
                                            onClick={setEditingTask}
                                            onDelete={handleDeleteTask}
                                            isDark={isDark}
                                            showProjectName={activeProject.id === HOME_VIEW.id && !t.isExternal ? (projects.find(p => p.id === t.projectId)?.name || '') : t.isExternal ? 'Externo' : ''}
                                            onOpenChecklist={setChecklistModalTask}
                                            onToggleReview={handleToggleReview}
                                            subtasksCount={subtasks.length}
                                            subtasksCompletedCount={completedSubCount}
                                            subtasks={subtasks}
                                            onToggleTracking={handleToggleTracking}
                                        />
                                    )
                                })}

                                {completedTasks.length > 0 && (
                                    <div className="pt-6">
                                        <button
                                            onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                                            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-4 transition-colors ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {isCompletedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Completado ({completedTasks.length})
                                        </button>

                                        {isCompletedExpanded && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                {completedTasks.map(t => {
                                                    const subtasks = tasks.filter(sub => sub.parentTaskId === t.id);
                                                    const completedSubCount = subtasks.filter(sub => sub.completed).length;
                                                    return (
                                                        <TaskItem
                                                            key={t.id}
                                                            task={t}
                                                            onToggle={handleToggleTask}
                                                            onClick={setEditingTask}
                                                            onDelete={handleDeleteTask}
                                                            isDark={isDark}
                                                            showProjectName={activeProject.id === HOME_VIEW.id && !t.isExternal ? (projects.find(p => p.id === t.projectId)?.name || '') : t.isExternal ? 'Externo' : ''}
                                                            onOpenChecklist={setChecklistModalTask}
                                                            onToggleReview={handleToggleReview}
                                                            subtasksCount={subtasks.length}
                                                            subtasksCompletedCount={completedSubCount}
                                                            subtasks={subtasks}
                                                            onToggleTracking={handleToggleTracking}
                                                        />
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'board' ? (
                    <KanbanBoard
                        tasks={activeRootTasks} // Uses same filtering as List view
                        projects={projects}
                        isDark={isDark}
                        onUpdateStatus={handleUpdateTaskStatus}
                        onEditTask={setEditingTask}
                        onQuickAdd={handleKanbanQuickAdd}
                    />
                ) : viewMode === 'dashboard' ? (
                    <DashboardBoard
                        tasks={tasks}
                        projects={projects}
                        pomodoroLogs={pomodoroLogs}
                        isDark={isDark}
                    />
                ) : (
                    <CalendarBoard
                        tasks={allTasks} // Pass ALL tasks (including external) to calendar
                        projects={projects.filter(p => p.id !== HOME_VIEW.id)}
                        onUpdateTask={handleUpdateTask}
                        onUpdateTaskTime={handleUpdateTaskTime}
                        isDark={isDark}
                        onEditTask={setEditingTask}
                    />
                )}

                {/* DETAILS PANEL (Global) */}
                <DetailsPanel
                    editingTask={editingTask}
                    setEditingTask={setEditingTask}
                    isDark={isDark}
                    handleToggleTask={handleToggleTask}
                    handleUpdateTaskDetail={handleUpdateTaskDetail}
                    handleDeleteTask={handleDeleteTask}
                    currentTaskSubtasks={currentTaskSubtasks}
                    handleAddSubtask={handleAddSubtask}
                    setChecklistModalTask={setChecklistModalTask}
                    panelRef={detailsPanelRef}
                    onReparentTask={handleReparentTask}
                    onToggleTracking={handleToggleTracking}
                    onResetTracking={handleResetTracking}
                />
            </div>
            <NotificationToast notification={notification} onClose={() => setNotification(null)} />
            <CloudSyncModal isOpen={isCloudSyncModalOpen} onClose={() => setIsCloudSyncModalOpen(false)} currentUserId={userId} isCustom={!!customUid} onSetCustomId={handleSetCustomId} onClearCustomId={handleClearCustomId} isDark={isDark} onActivateCloudMode={handleActivateCloudMode} />
            <PomodoroLogModal isOpen={pomodoroLogModalOpen} projects={projects} onSave={handleLogPomodoro} onCancel={() => setPomodoroLogModalOpen(false)} isDark={isDark} minutes={completedFocusMinutes} />
            <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ isOpen: false })} isDark={isDark} />
            <TaskNoteModal isOpen={!!checklistModalTask} onClose={() => setChecklistModalTask(null)} task={checklistModalTask} onUpdateNote={handleUpdateNote} isDark={isDark} />
            <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} isDark={isDark} editingProject={editingProject} name={projectName} setName={setProjectName} links={projectLinks} setLinks={setProjectLinks} color={projectColor} setColor={setProjectColor} onSave={handleSaveProject} />
            <CalendarSubscribeModal isOpen={isCalendarSubscribeModalOpen} onClose={() => setIsCalendarSubscribeModalOpen(false)} isDark={isDark} onSubscribe={handleSubscribeCalendar} />
        </div>
    );
};

export default App;