import React, { useMemo } from 'react';
import { Task, Project, PomodoroLog } from '../types';
import { safeDate } from '../utils';
import { TaskItem } from './task-item';
import { CheckCircle2, AlertCircle, Clock, Flame, Calendar, MapPin, Target, Sparkles, Brain, ArrowRight, Printer } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface HomeDashboardProps {
    tasks: Task[];
    projects: Project[];
    pomodoroLogs: PomodoroLog[];
    isDark: boolean;
    userName: string;
    onEditTask: (task: Task) => void;
    onToggleTask: (task: Task) => void;
    onOpenExportModal?: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4', '#6366f1'];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ tasks, projects, pomodoroLogs, isDark, userName, onEditTask, onToggleTask, onOpenExportModal }) => {
    
    // Calculate Today String
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const rootTasks = tasks.filter(t => !t.parentTaskId);

    const stats = useMemo(() => {
        let overdue = 0;
        let pHigh = 0;
        let dueToday = 0;
        let completedToday = 0;
        let totalFocusToday = 0;

        rootTasks.forEach(t => {
            if (!t.completed) {
                if (t.dueDate === todayStr) dueToday++;
                if (t.priority === 'high' || t.priority === 'do_first') pHigh++;
                
                if (t.dueDate && t.dueDate < todayStr) {
                    overdue++;
                }
            } else if (t.completedAt) {
                 const compDate = safeDate(t.completedAt);
                 if (compDate && compDate >= todayDate) {
                     completedToday++;
                     if (t.dueDate === todayStr) dueToday++; // it was due today but is now completed
                 }
            }
        });

        pomodoroLogs.forEach(log => {
            const lDate = safeDate(log.createdAt);
            if (lDate && lDate >= todayDate) {
                totalFocusToday += log.durationMinutes;
            }
        });

        return { overdue, pHigh, dueToday, completedToday, totalFocusToday };
    }, [rootTasks, pomodoroLogs, todayStr, todayDate]);

    // Data for Donut Chart
    const projectFocusData = useMemo(() => {
        const pendingCount: Record<string, number> = {};
        rootTasks.filter(t => !t.completed).forEach(t => {
            pendingCount[t.projectId] = (pendingCount[t.projectId] || 0) + 1;
        });
        
        return Object.keys(pendingCount).map(pid => {
            const p = projects.find(proj => proj.id === pid);
            return {
                name: p ? p.name : 'Varios',
                value: pendingCount[pid]
            };
        }).filter(d => d.value > 0).sort((a,b) => b.value - a.value).slice(0, 5); // top 5 projects
    }, [rootTasks, projects]);

    const todayTasks = rootTasks.filter(t => !t.completed && t.dueDate === todayStr).sort((a, b) => {
        if (a.dueTime && b.dueTime) {
            if (a.dueTime !== b.dueTime) return a.dueTime.localeCompare(b.dueTime);
        } else if (a.dueTime) return -1;
        else if (b.dueTime) return 1;
        
        // Fallback to priority
        const priorityScore: any = { high: 3, medium: 2, low: 1, none: 0 };
        const scoreA = priorityScore[a.priority || 'none'] || 0;
        const scoreB = priorityScore[b.priority || 'none'] || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;

        // Fallback to title
        return a.title.localeCompare(b.title);
    });

    const upcomingTasks = rootTasks.filter(t => !t.completed && t.dueDate > todayStr && t.dueDate <= new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0,10))
        .sort((a, b) => {
            if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            return a.title.localeCompare(b.title);
        });

    const progressPercent = stats.dueToday > 0 ? Math.round((stats.completedToday / stats.dueToday) * 100) : 100;

    return (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-8 pb-24">
            {/* Actions Bar */}
            {onOpenExportModal && (
                <div className="flex justify-end mb-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                    <button 
                        onClick={onOpenExportModal} 
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 transition-all rounded-xl text-sm font-bold shadow-sm border ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}
                    >
                        <Printer size={16} /> Exportar Todas las Tareas
                    </button>
                </div>
            )}
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className={`p-5 rounded-2xl border transition-all hover:scale-105 duration-200 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-red-500/10 text-red-500"><AlertCircle size={20} /></div>
                        <span className="text-2xl font-black text-red-500">{stats.overdue}</span>
                    </div>
                    <p className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Atrasadas</p>
                </div>
                <div className={`p-5 rounded-2xl border transition-all hover:scale-105 duration-200 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500"><Flame size={20} /></div>
                        <span className="text-2xl font-black text-orange-500">{stats.pHigh}</span>
                    </div>
                    <p className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Prioridad Alta</p>
                </div>
                <div className={`p-5 rounded-2xl border transition-all hover:scale-105 duration-200 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500"><Brain size={20} /></div>
                        <div className="text-right">
                           <span className="text-2xl font-black text-violet-500">{stats.totalFocusToday}</span>
                           <span className="text-xs text-violet-500/70 ml-1">min</span>
                        </div>
                    </div>
                    <p className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Enfoque Hoy</p>
                </div>
                <div className={`p-5 rounded-2xl border transition-all hover:scale-105 duration-200 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"><CheckCircle2 size={20} /></div>
                        <span className="text-2xl font-black text-emerald-500">{stats.completedToday}</span>
                    </div>
                    <p className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Victorias Hoy</p>
                </div>
            </div>

            {/* Split Views */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-700">
                {/* Center / Left Panel: My Today Focus */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Target className="text-emerald-500" />
                            Tu Foco de Hoy
                        </h2>
                    </div>

                    <div className="space-y-2">
                        {todayTasks.length === 0 ? (
                            <div className={`p-10 text-center rounded-2xl border border-dashed ${isDark ? 'bg-zinc-900/50 border-zinc-800 text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                <Sparkles size={32} className="mx-auto mb-3 opacity-50 text-emerald-500" />
                                <p className="font-semibold">¡Nada programado para hoy!</p>
                                <p className="text-sm">Tómate un respiro o planea adelante.</p>
                            </div>
                        ) : (
                            todayTasks.map(t => (
                                <TaskItem 
                                    key={t.id} 
                                    task={t} 
                                    onToggle={onToggleTask} 
                                    onClick={onEditTask} 
                                    isDark={isDark} 
                                    showProjectName={projects.find(p => p.id === t.projectId)?.name || 'Inbox'}
                                />
                            ))
                        )}
                    </div>

                    <h2 className="text-lg font-bold flex items-center gap-2 mt-10 mb-4">
                        <Calendar className="text-blue-500" />
                        Próximos días
                    </h2>
                    <div className="space-y-2">
                        {upcomingTasks.length === 0 ? (
                            <div className="p-6 text-center opacity-50 text-sm">No tienes eventos cercanos programados.</div>
                        ) : (
                            upcomingTasks.slice(0, 5).map(t => (
                                <TaskItem 
                                    key={t.id} 
                                    task={t} 
                                    onToggle={onToggleTask} 
                                    onClick={onEditTask} 
                                    isDark={isDark} 
                                    showProjectName={projects.find(p => p.id === t.projectId)?.name || 'Inbox'}
                                />
                            ))
                        )}
                        {upcomingTasks.length > 5 && (
                             <div className="text-center pt-2">
                                <span className="text-xs font-bold opacity-50 uppercase tracking-widest">+ {upcomingTasks.length - 5} tareas más...</span>
                             </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Data Vis */}
                <div className="space-y-6">
                    <div className={`p-6 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'}`}>
                        <h3 className="font-bold mb-6 flex items-center gap-2">
                            <MapPin className="text-rose-500" />
                            Distribución de Tareas
                        </h3>
                        {projectFocusData.length > 0 ? (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={projectFocusData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {projectFocusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip 
                                            contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', fontWeight: 'bold' }} 
                                            itemStyle={{ color: isDark ? '#fff' : '#000' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center opacity-50 text-sm font-medium">
                                No hay datos suficientes
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
