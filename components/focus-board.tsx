import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Target, Trophy, Sunset, Star, Brain, AlertTriangle,
    CheckCircle2, Circle, Clock, TrendingUp, ArrowRight,
    Zap, X, Moon, ChevronDown, Flag, Calendar, Repeat,
    BarChart2, Layers, Activity, Plus, Users
} from 'lucide-react';
import { Task, Project } from '../types';
import { PRIORITIES, PROJECT_COLORS, formatDate } from '../utils';

// ─── localStorage keys ────────────────────────────────────────────────────────
const CS_COUNT_KEY = 'taskflow_cs_count';   // context switch count today
const CS_DATE_KEY = 'taskflow_cs_date';    // date of count
const CS_PROJ_KEY = 'taskflow_cs_project'; // last project id
const CS_TIME_KEY = 'taskflow_cs_time';    // last switch timestamp
const FOCUS_PROJ_KEY = 'taskflow_focus_project';

// ─── Types ────────────────────────────────────────────────────────────────────
type FocusTab = 'top3' | 'deep-work' | 'cierre';

interface FocusBoardProps {
    tasks: Task[];
    projects: Project[];
    isDark: boolean;
    onUpdateTaskField: (taskId: string, fields: Partial<Task>) => Promise<void>;
    onToggleTask: (task: Task) => void;
    onEditTask: (task: Task) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const priorityColors: Record<string, string> = {
    high: 'text-red-500', medium: 'text-amber-500', low: 'text-blue-400', none: 'text-zinc-600'
};

const TaskRow = ({ task, isDark, action, actionIcon, actionLabel, actionColor, projectName }: {
    task: Task; isDark: boolean;
    action: () => void; actionIcon: React.ReactNode;
    actionLabel: string; actionColor: string;
    projectName?: string;
}) => {
    const priorityStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
    return (
        <div className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isDark ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
            } ${task.completed ? 'opacity-50' : ''}`}>
            {task.completed
                ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                : <Circle size={18} className={`flex-shrink-0 ${isDark ? 'text-zinc-600' : 'text-gray-300'}`} />
            }
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${task.completed ? 'line-through opacity-60' : isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                    {task.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    {projectName && (
                        <span className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{projectName}</span>
                    )}
                    {task.dueDate && (
                        <span className={`text-[10px] flex items-center gap-0.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                            <Calendar size={9} /> {formatDate(task.dueDate)}
                        </span>
                    )}
                    {task.priority && task.priority !== 'none' && (
                        <Flag size={10} className={priorityColors[task.priority]} fill="currentColor" />
                    )}
                </div>
            </div>
            <button
                onClick={action}
                title={actionLabel}
                className={`flex-shrink-0 p-1.5 rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100 ${actionColor}`}
            >
                {actionIcon}
            </button>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const FocusBoard: React.FC<FocusBoardProps> = ({
    tasks, projects, isDark, onUpdateTaskField, onToggleTask, onEditTask
}) => {
    const today = new Date().toDateString();

    // ── Tab ────────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<FocusTab>('top3');

    // ── Focus project (Deep Work) ──────────────────────────────────────────────
    const [focusProjectId, setFocusProjectId] = useState<string>(() => {
        const saved = localStorage.getItem(FOCUS_PROJ_KEY);
        return saved || (projects.find(p => p.id !== 'home')?.id || '');
    });

    // ── Context Switch counter ─────────────────────────────────────────────────
    const [contextSwitches, setContextSwitches] = useState<number>(() => {
        const savedDate = localStorage.getItem(CS_DATE_KEY);
        if (savedDate !== today) {
            localStorage.setItem(CS_DATE_KEY, today);
            localStorage.setItem(CS_COUNT_KEY, '0');
            return 0;
        }
        return parseInt(localStorage.getItem(CS_COUNT_KEY) || '0', 10);
    });

    // ── WIP ────────────────────────────────────────────────────────────────────
    const wipTasks = useMemo(() =>
        tasks.filter(t => t.status === 'in_progress' && !t.completed && !t.parentTaskId),
        [tasks]
    );
    const wipOverload = wipTasks.length > 3;
    const [showWipDetail, setShowWipDetail] = useState(false);

    // ── Top 3 Victorias ────────────────────────────────────────────────────────
    const top3Tasks = useMemo(() =>
        tasks.filter(t => (t as any).isDayWin && !t.parentTaskId),
        [tasks]
    );
    const nonVictoryPendingTasks = useMemo(() =>
        tasks.filter(t => !(t as any).isDayWin && !t.completed && !t.parentTaskId)
            .sort((a, b) => {
                const ps: any = { high: 3, medium: 2, low: 1, none: 0 };
                return (ps[b.priority] || 0) - (ps[a.priority] || 0);
            }),
        [tasks]
    );

    // ── Deep Work ──────────────────────────────────────────────────────────────
    const focusTasks = useMemo(() =>
        tasks.filter(t => t.projectId === focusProjectId && !t.completed && !t.parentTaskId)
            .sort((a, b) => {
                const ps: any = { high: 3, medium: 2, low: 1, none: 0 };
                return (ps[b.priority] || 0) - (ps[a.priority] || 0);
            }),
        [tasks, focusProjectId]
    );
    const focusProject = projects.find(p => p.id === focusProjectId);

    // ── Cierre de Jornada ──────────────────────────────────────────────────────
    const [tomorrowIds, setTomorrowIds] = useState<string[]>([]);
    const [cierreCompleted, setCierreCompleted] = useState(false);
    const completedVictories = top3Tasks.filter(t => t.completed);
    const pendingVictories = top3Tasks.filter(t => !t.completed);

    // ──────────────────────────────────────────────────────────────────────────
    // Handlers
    // ──────────────────────────────────────────────────────────────────────────

    const handleToggleVictory = useCallback(async (task: Task) => {
        const isCurrentlyWin = !!(task as any).isDayWin;
        if (!isCurrentlyWin && top3Tasks.length >= 3) return; // Max 3
        await onUpdateTaskField(task.id, { isDayWin: !isCurrentlyWin } as any);
    }, [top3Tasks, onUpdateTaskField]);

    const handleFocusProjectChange = useCallback((newProjectId: string) => {
        const lastProject = localStorage.getItem(CS_PROJ_KEY);
        const lastTime = parseInt(localStorage.getItem(CS_TIME_KEY) || '0', 10);
        const now = Date.now();
        const SIXTY_MIN = 60 * 60 * 1000;

        if (lastProject && lastProject !== newProjectId && (now - lastTime) < SIXTY_MIN) {
            const newCount = contextSwitches + 1;
            setContextSwitches(newCount);
            localStorage.setItem(CS_COUNT_KEY, newCount.toString());
        }
        localStorage.setItem(CS_PROJ_KEY, newProjectId);
        localStorage.setItem(CS_TIME_KEY, now.toString());
        localStorage.setItem(FOCUS_PROJ_KEY, newProjectId);
        setFocusProjectId(newProjectId);
    }, [contextSwitches]);

    const toggleTomorrowVictory = (taskId: string) => {
        setTomorrowIds(prev =>
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : prev.length < 3 ? [...prev, taskId] : prev
        );
    };

    const handleCierreJornada = async () => {
        // Unmark all current victories
        for (const t of top3Tasks) {
            await onUpdateTaskField(t.id, { isDayWin: false } as any);
        }
        // Mark tomorrow's selected
        for (const id of tomorrowIds) {
            await onUpdateTaskField(id, { isDayWin: true } as any);
        }
        setTomorrowIds([]);
        setCierreCompleted(true);
    };

    // ──────────────────────────────────────────────────────────────────────────
    // UI Sections
    // ──────────────────────────────────────────────────────────────────────────

    const csColor = contextSwitches === 0
        ? isDark ? 'text-emerald-400' : 'text-emerald-600'
        : contextSwitches <= 2
            ? isDark ? 'text-amber-400' : 'text-amber-600'
            : isDark ? 'text-red-400' : 'text-red-500';

    const csLabel = contextSwitches === 0
        ? 'Sin interrupciones 🎯'
        : contextSwitches <= 2
            ? `${contextSwitches} salto${contextSwitches > 1 ? 's' : ''} de contexto`
            : `⚠️ ${contextSwitches} interrupciones de flujo`;

    const tabs: { id: FocusTab; label: string; icon: React.ReactNode }[] = [
        { id: 'top3', label: 'Top 3 Victorias', icon: <Trophy size={14} /> },
        { id: 'deep-work', label: 'Enfoque Profundo', icon: <Target size={14} /> },
        { id: 'cierre', label: 'Cierre de Jornada', icon: <Moon size={14} /> },
    ];

    return (
        <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>

            {/* ── WIP OVERLOAD BANNER ─────────────────────────────────────────── */}
            {wipOverload && (
                <div className={`flex items-center gap-3 px-6 py-2.5 border-b text-sm font-medium ${isDark
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                    <AlertTriangle size={16} className="flex-shrink-0 animate-pulse" />
                    <span>
                        <strong>⚠️ Sobrecarga Mental</strong> — Tienes {wipTasks.length} tareas en curso simultáneamente (límite recomendado: 3).
                    </span>
                    <button
                        onClick={() => setShowWipDetail(!showWipDetail)}
                        className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                    >
                        {showWipDetail ? 'Ocultar' : 'Ver tareas'}
                    </button>
                    {showWipDetail && (
                        <div className={`absolute top-28 right-6 z-50 w-72 p-4 rounded-xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-red-500/30' : 'bg-white border-red-200'
                            }`}>
                            <p className={`text-xs font-bold mb-3 uppercase tracking-wider ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                                Tareas En Curso
                            </p>
                            {wipTasks.map(t => (
                                <div key={t.id} className={`text-xs py-1.5 border-b last:border-0 ${isDark ? 'border-zinc-800 text-zinc-300' : 'border-gray-100 text-gray-700'}`}>
                                    {t.title}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <div className={`flex items-center justify-between px-8 pt-6 pb-4 border-b flex-shrink-0 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div>
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                        <Brain size={22} className="text-violet-500" />
                        Modo Enfoque
                    </h2>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                        Elimina el ruido · Protege tu flujo mental
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* WIP Indicator */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${wipOverload
                            ? isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-300 text-red-600'
                            : isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-white border-gray-200 text-gray-500'
                        }`}>
                        <Layers size={13} />
                        WIP: <strong>{wipTasks.length}/3</strong>
                    </div>

                    {/* Context Switch Counter */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
                        } ${csColor}`}>
                        <Activity size={13} />
                        <span>{csLabel}</span>
                        {contextSwitches > 0 && (
                            <button
                                title="Resetear contador"
                                onClick={() => {
                                    setContextSwitches(0);
                                    localStorage.setItem(CS_COUNT_KEY, '0');
                                }}
                                className="ml-1 opacity-50 hover:opacity-100"
                            >
                                <X size={11} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── TABS ────────────────────────────────────────────────────────── */}
            <div className={`flex items-center gap-1 px-8 pt-4 flex-shrink-0 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-violet-500 text-violet-500'
                                : `border-transparent ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.id === 'top3' && top3Tasks.length > 0 && (
                            <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${activeTab === 'top3'
                                    ? 'bg-violet-500 text-white'
                                    : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-500'
                                }`}>
                                {top3Tasks.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── CONTENT ──────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* ══════════════════════════════════════
                    TAB: TOP 3 VICTORIAS
                ══════════════════════════════════════ */}
                {activeTab === 'top3' && (
                    <div className="max-w-2xl mx-auto px-4 py-8">

                        {/* Progress */}
                        <div className={`mb-8 p-5 rounded-2xl border ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    Victorias del Día
                                </span>
                                <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                    {completedVictories.length} / {top3Tasks.length}
                                </span>
                            </div>
                            <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700"
                                    style={{ width: top3Tasks.length > 0 ? `${(completedVictories.length / top3Tasks.length) * 100}%` : '0%' }}
                                />
                            </div>
                            {top3Tasks.length === 0 && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                    Selecciona hasta 3 tareas como tus victorias del día →
                                </p>
                            )}
                        </div>

                        {/* Slots */}
                        <div className="space-y-3 mb-8">
                            <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                <Trophy size={12} className="text-amber-500" /> Mis 3 Victorias
                            </h3>
                            {top3Tasks.length === 0 ? (
                                [1, 2, 3].map(n => (
                                    <div key={n} className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed ${isDark ? 'border-zinc-800 text-zinc-700' : 'border-gray-200 text-gray-300'
                                        }`}>
                                        <Star size={16} />
                                        <span className="text-sm">Victoria #{n}</span>
                                    </div>
                                ))
                            ) : (
                                top3Tasks.map(task => {
                                    const proj = projects.find(p => p.id === task.projectId);
                                    return (
                                        <div key={task.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${task.completed
                                                ? isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                                                : isDark ? 'bg-violet-500/10 border-violet-500/30' : 'bg-violet-50 border-violet-200'
                                            }`}>
                                            <button onClick={() => onToggleTask(task)}>
                                                {task.completed
                                                    ? <CheckCircle2 size={20} className="text-emerald-500" />
                                                    : <Circle size={20} className={isDark ? 'text-violet-500' : 'text-violet-400'} />
                                                }
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold truncate ${task.completed ? 'line-through opacity-60' : isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                                    {task.title}
                                                </p>
                                                {proj && (
                                                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{proj.name}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleToggleVictory(task)}
                                                title="Quitar de victorias"
                                                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-red-400' : 'hover:bg-gray-100 text-gray-300 hover:text-red-500'}`}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}

                            {/* Empty slots */}
                            {top3Tasks.length > 0 && top3Tasks.length < 3 && (
                                [...Array(3 - top3Tasks.length)].map((_, i) => (
                                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed ${isDark ? 'border-zinc-800 text-zinc-700' : 'border-gray-200 text-gray-300'
                                        }`}>
                                        <Star size={16} />
                                        <span className="text-sm">Slot disponible</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Available tasks to mark as victory */}
                        {top3Tasks.length < 3 && nonVictoryPendingTasks.length > 0 && (
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    <Plus size={12} /> Añadir Victoria ({top3Tasks.length}/3 seleccionadas)
                                </h3>
                                <div className="space-y-2">
                                    {nonVictoryPendingTasks.slice(0, 12).map(task => {
                                        const proj = projects.find(p => p.id === task.projectId);
                                        return (
                                            <TaskRow
                                                key={task.id}
                                                task={task}
                                                isDark={isDark}
                                                projectName={proj?.name}
                                                action={() => handleToggleVictory(task)}
                                                actionIcon={<Star size={14} />}
                                                actionLabel="Marcar como Victoria del Día"
                                                actionColor={isDark
                                                    ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
                                                    : 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════
                    TAB: ENFOQUE PROFUNDO (DEEP WORK)
                ══════════════════════════════════════ */}
                {activeTab === 'deep-work' && (
                    <div className="max-w-2xl mx-auto px-4 py-8">

                        {/* Project selector */}
                        <div className={`mb-6 p-5 rounded-2xl border ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <label className={`block text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                <Target size={12} className="text-violet-500" /> Proyecto del Bloque de Enfoque
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {projects.filter(p => p.id !== 'home').map(proj => {
                                    const colorStyle = PROJECT_COLORS[proj.color || 'gray'];
                                    const isSelected = proj.id === focusProjectId;
                                    const pendingCount = tasks.filter(t => t.projectId === proj.id && !t.completed && !t.parentTaskId).length;
                                    return (
                                        <button
                                            key={proj.id}
                                            onClick={() => handleFocusProjectChange(proj.id)}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${isSelected
                                                    ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                                                    : isDark
                                                        ? 'border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorStyle?.dot || 'bg-gray-400'}`} />
                                            <span className="text-xs font-semibold truncate flex-1">{proj.name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected
                                                    ? 'bg-violet-500/20 text-violet-400'
                                                    : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {pendingCount}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Context switch hint */}
                        {contextSwitches > 0 && (
                            <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-700'
                                }`}>
                                <Activity size={13} />
                                Cambiaste de proyecto {contextSwitches} vez{contextSwitches > 1 ? 'ces' : ''} hoy. Cada cambio interrumpe hasta 23 minutos de flujo.
                            </div>
                        )}

                        {/* Focus tasks list */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    {focusProject && (
                                        <>
                                            <div className={`w-2 h-2 rounded-full ${PROJECT_COLORS[focusProject.color || 'gray']?.dot || 'bg-gray-400'}`} />
                                            {focusProject.name}
                                        </>
                                    )}
                                    — Tareas Pendientes
                                </h3>
                                <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                    {focusTasks.length} tarea{focusTasks.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {focusTasks.length === 0 ? (
                                <div className={`text-center py-12 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/50" />
                                    <p className="text-sm font-medium">¡Proyecto limpio!</p>
                                    <p className="text-xs mt-1">No hay tareas pendientes en este proyecto.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {focusTasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => onEditTask(task)}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${isDark ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                                }`}
                                        >
                                            <button onClick={(e) => { e.stopPropagation(); onToggleTask(task); }}>
                                                <Circle size={18} className={isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-300 hover:text-emerald-500'} />
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                                    {task.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {task.dueDate && (
                                                        <span className={`text-[10px] flex items-center gap-0.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                                            <Calendar size={9} /> {formatDate(task.dueDate)}
                                                        </span>
                                                    )}
                                                    {task.recurrence && task.recurrence !== 'none' && (
                                                        <Repeat size={9} className={isDark ? 'text-blue-400' : 'text-blue-500'} />
                                                    )}
                                                </div>
                                            </div>
                                            {task.priority && task.priority !== 'none' && (
                                                <Flag size={12} className={priorityColors[task.priority]} fill="currentColor" />
                                            )}
                                            {(task as any).isDayWin && (
                                                <Star size={13} className="text-amber-500" fill="currentColor" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════
                    TAB: CIERRE DE JORNADA
                ══════════════════════════════════════ */}
                {activeTab === 'cierre' && (
                    <div className="max-w-2xl mx-auto px-4 py-8">

                        {cierreCompleted ? (
                            <div className="text-center py-16">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                                    <Moon size={32} className="text-emerald-500" />
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                    ¡Jornada cerrada!
                                </h3>
                                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    Mañana tendrás tus nuevas victorias listas.
                                </p>
                                <button
                                    onClick={() => setCierreCompleted(false)}
                                    className="mt-6 px-4 py-2 text-xs font-bold rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
                                >
                                    Volver al resumen
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Today's summary */}
                                <div className="mb-8">
                                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                        <BarChart2 size={12} /> Resumen de Hoy
                                    </h3>

                                    {top3Tasks.length === 0 ? (
                                        <div className={`text-center py-8 rounded-2xl border border-dashed ${isDark ? 'border-zinc-800 text-zinc-600' : 'border-gray-200 text-gray-400'}`}>
                                            <p className="text-sm">No tienes victorias asignadas para hoy.</p>
                                            <button
                                                onClick={() => setActiveTab('top3')}
                                                className="mt-2 text-xs text-violet-400 hover:underline"
                                            >
                                                Ir a Top 3 Victorias →
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {completedVictories.map(t => (
                                                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                                                    <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                                                    <span className={`text-sm font-medium line-through ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{t.title}</span>
                                                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>✓ Completada</span>
                                                </div>
                                            ))}
                                            {pendingVictories.map(t => (
                                                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? 'bg-amber-500/8 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                                                    <Circle size={18} className="text-amber-500 flex-shrink-0" />
                                                    <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{t.title}</span>
                                                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>Pendiente</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Tomorrow's victories picker */}
                                <div className="mb-8">
                                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                        <Zap size={12} className="text-violet-500" /> Elige tus 3 Victorias de Mañana
                                    </h3>
                                    <p className={`text-xs mb-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                        Selecciona hasta 3 tareas. Las victorias de hoy se moverán al backlog al cerrar.
                                        {tomorrowIds.length > 0 && ` (${tomorrowIds.length}/3 seleccionadas)`}
                                    </p>
                                    <div className="space-y-2">
                                        {tasks
                                            .filter(t => !t.completed && !t.parentTaskId)
                                            .sort((a, b) => {
                                                const ps: any = { high: 3, medium: 2, low: 1, none: 0 };
                                                return (ps[b.priority] || 0) - (ps[a.priority] || 0);
                                            })
                                            .slice(0, 15)
                                            .map(task => {
                                                const proj = projects.find(p => p.id === task.projectId);
                                                const isSelected = tomorrowIds.includes(task.id);
                                                return (
                                                    <button
                                                        key={task.id}
                                                        onClick={() => toggleTomorrowVictory(task.id)}
                                                        disabled={!isSelected && tomorrowIds.length >= 3}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-40 ${isSelected
                                                                ? isDark
                                                                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                                                                    : 'border-violet-400 bg-violet-50 text-violet-700'
                                                                : isDark
                                                                    ? 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                                                                    : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                                                            }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${isSelected
                                                                ? 'bg-violet-500 border-violet-500'
                                                                : isDark ? 'border-zinc-700' : 'border-gray-300'
                                                            }`}>
                                                            {isSelected && <CheckCircle2 size={10} className="text-white" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                                            {proj && <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{proj.name}</p>}
                                                        </div>
                                                        {task.priority && task.priority !== 'none' && (
                                                            <Flag size={11} className={priorityColors[task.priority]} fill="currentColor" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* Close button */}
                                <button
                                    onClick={handleCierreJornada}
                                    disabled={tomorrowIds.length === 0}
                                    className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${tomorrowIds.length === 0
                                            ? isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/20'
                                        }`}
                                >
                                    <Moon size={16} />
                                    Cerrar Jornada y Preparar Mañana
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
