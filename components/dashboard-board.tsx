import React, { useMemo } from 'react';
import { Activity, Clock, CheckCircle2, List, Trash2, Flame } from 'lucide-react';
import { Task, Project, PomodoroLog } from '../types';
import { safeDate, formatDate } from '../utils';

interface DashboardBoardProps {
    tasks: Task[];
    projects: Project[];
    pomodoroLogs: PomodoroLog[];
    isDark: boolean;
}

export const DashboardBoard = ({ tasks, projects, pomodoroLogs, isDark }: DashboardBoardProps) => {
    // Analytics calculations for the last 7 days
    const { daysCategories, pomodoroData, tasksData, summary } = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const days = [];
        const pData = [];
        const tCompleted = [];
        const tCreated = [];

        // Build last 7 days buckets
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            days.push(d.toLocaleDateString('es-ES', { weekday: 'short' }));
            pData.push(0);
            tCompleted.push(0);
            tCreated.push(0);
        }

        // Process Pomodoro Logs -> Minutes
        let totalFocus = 0;
        pomodoroLogs.forEach(log => {
            const date = safeDate(log.createdAt);
            if (date && date >= sevenDaysAgo && date <= today) {
                const diffDays = Math.floor((date.getTime() - sevenDaysAgo.getTime()) / (1000 * 3600 * 24));
                if (diffDays >= 0 && diffDays < 7) {
                    pData[diffDays] += log.durationMinutes;
                    totalFocus += log.durationMinutes;
                }
            }
        });

        // Process Tasks
        let completedWeek = 0;
        let pendingTotal = 0;

        tasks.forEach(t => {
            if (!t.completed) pendingTotal++;

            // Check completed tasks in last 7 days
            if (t.completed && t.completedAt) {
                const cDate = safeDate(t.completedAt);
                if (cDate && cDate >= sevenDaysAgo && cDate <= today) {
                    const diffDays = Math.floor((cDate.getTime() - sevenDaysAgo.getTime()) / (1000 * 3600 * 24));
                    if (diffDays >= 0 && diffDays < 7) {
                        tCompleted[diffDays]++;
                        completedWeek++;
                    }
                }
            }

            // Check created tasks in last 7 days
            if (t.createdAt) {
                const crDate = safeDate(t.createdAt);
                if (crDate && crDate >= sevenDaysAgo && crDate <= today) {
                    const diffDays = Math.floor((crDate.getTime() - sevenDaysAgo.getTime()) / (1000 * 3600 * 24));
                    if (diffDays >= 0 && diffDays < 7) {
                        tCreated[diffDays]++;
                    }
                }
            }
        });

        // Calculate "Streak" - consecutive days with at least 1 completed task
        let streak = 0;
        for (let i = 6; i >= 0; i--) {
            if (tCompleted[i] > 0) streak++;
            else if (i !== 6) break; // If not today, streak broke
        }

        return {
            daysCategories: days,
            pomodoroData: pData,
            tasksData: { completed: tCompleted, created: tCreated },
            summary: {
                totalFocusHours: (totalFocus / 60).toFixed(1),
                completedWeek,
                pendingTotal,
                streak
            }
        };
    }, [tasks, pomodoroLogs]);

    const maxPomodoro = Math.max(...pomodoroData, 60); // min scale is 60 mins
    const maxTasks = Math.max(...tasksData.created, ...tasksData.completed, 5); // min scale is 5 tasks

    return (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="mb-2">
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Estadísticas</h2>
                    <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Resumen de tu rendimiento de los últimos 7 días</p>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <ScoreCard isDark={isDark} title="Focus Semanal" value={`${summary.totalFocusHours}h`} icon={<Clock />} color="text-amber-500" bg="bg-amber-500/10" />
                    <ScoreCard isDark={isDark} title="Tareas Completadas" value={summary.completedWeek} icon={<CheckCircle2 />} color="text-emerald-500" bg="bg-emerald-500/10" />
                    <ScoreCard isDark={isDark} title="Tareas Pendientes" value={summary.pendingTotal} icon={<List />} color="text-blue-500" bg="bg-blue-500/10" />
                    <ScoreCard isDark={isDark} title="Racha (Streak)" value={`${summary.streak} días`} icon={<Flame />} color="text-rose-500" bg="bg-rose-500/10" />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pomodoro Chart */}
                    <div className={`p-6 rounded-2xl border transition-colors ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-6">
                            <Clock size={18} className="text-amber-500" />
                            <h3 className={`font-bold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Minutos de Enfoque (Pomodoro)</h3>
                        </div>
                        <div className="h-48 flex items-end gap-2">
                            {pomodoroData.map((val, i) => {
                                const height = `${Math.max((val / maxPomodoro) * 100, 5)}%`;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="w-full flex-1 flex items-end relative rounded-t-lg bg-transparent hover:bg-zinc-800/10 dark:hover:bg-white/5 transition-colors">
                                            {/* Tooltip */}
                                            <div className={`opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] font-bold z-10 whitespace-nowrap transition-opacity ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-800 text-white'}`}>
                                                {val} min
                                            </div>
                                            {/* Bar */}
                                            <div
                                                className={`w-full rounded-t-lg transition-all duration-1000 ${i === 6 ? 'bg-amber-500' : isDark ? 'bg-zinc-800' : 'bg-gray-200'}`}
                                                style={{ height }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${i === 6 ? 'text-amber-500' : isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                            {daysCategories[i]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tasks Chart */}
                    <div className={`p-6 rounded-2xl border transition-colors ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-6">
                            <Activity size={18} className="text-emerald-500" />
                            <h3 className={`font-bold ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Tareas (Creadas vs Completadas)</h3>
                        </div>
                        <div className="h-48 flex items-end gap-2">
                            {daysCategories.map((day, i) => {
                                const cHeight = `${Math.max((tasksData.completed[i] / maxTasks) * 100, 2)}%`;
                                const rHeight = `${Math.max((tasksData.created[i] / maxTasks) * 100, 2)}%`;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="w-full flex-1 flex justify-center items-end relative gap-1 rounded-t-lg bg-transparent hover:bg-zinc-800/10 dark:hover:bg-white/5 transition-colors">
                                            {/* Tooltip */}
                                            <div className={`opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] space-y-0.5 z-10 whitespace-nowrap transition-opacity ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-800 text-white'}`}>
                                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {tasksData.created[i]} creadas</div>
                                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {tasksData.completed[i]} completas</div>
                                            </div>

                                            {/* Bar Created */}
                                            <div className={`w-1/2 rounded-t-md transition-all duration-1000 ${i === 6 ? 'bg-blue-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} style={{ height: rHeight }} />
                                            {/* Bar Completed */}
                                            <div className={`w-1/2 rounded-t-md transition-all duration-1000 ${i === 6 ? 'bg-emerald-500' : isDark ? 'bg-zinc-600' : 'bg-gray-400'}`} style={{ height: cHeight }} />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${i === 6 ? 'text-emerald-500' : isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                            {day}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Info Note */}
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400' : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'}`}>
                    <Activity size={20} className={isDark ? 'text-zinc-500' : 'text-emerald-600'} />
                    Tu productividad se calcula tomando en cuenta la última semana (pasada medianoche se reiniciarán los datos del día actual).
                </div>
            </div>
        </div>
    );
};

const ScoreCard = ({ isDark, title, value, icon, color, bg }: any) => (
    <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] cursor-default ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-xl ${bg} ${color}`}>{icon}</div>
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{title}</span>
        </div>
        <div className={`text-3xl font-black ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{value}</div>
    </div>
);
