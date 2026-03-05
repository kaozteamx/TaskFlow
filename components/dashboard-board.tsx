import React, { useMemo } from 'react';
import { Activity, Clock, CheckCircle2, List, Trash2, Flame, PieChart as PieChartIcon, Timer } from 'lucide-react';
import { Task, Project, PomodoroLog } from '../types';
import { safeDate, formatDate, PROJECT_COLORS } from '../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface DashboardBoardProps {
    tasks: Task[];
    projects: Project[];
    pomodoroLogs: PomodoroLog[];
    isDark: boolean;
}

const TAILWIND_HEX: Record<string, string> = {
    'bg-red-500': '#ef4444',
    'bg-amber-500': '#f59e0b',
    'bg-yellow-500': '#eab308',
    'bg-emerald-500': '#10b981',
    'bg-blue-500': '#3b82f6',
    'bg-indigo-500': '#6366f1',
    'bg-violet-500': '#8b5cf6',
    'bg-pink-500': '#ec4899',
    'bg-rose-500': '#f43f5e',
    'bg-zinc-500': '#71717a',
    'bg-gray-500': '#6b7280'
};

export const DashboardBoard = ({ tasks, projects, pomodoroLogs, isDark }: DashboardBoardProps) => {
    // Analytics calculations for the last 7 days
    const { daysCategories, chartDataWeekly, timeDistribData, summary } = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const days = [];
        const chartDataWeekly = [];

        // Build last 7 days buckets
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            days.push(d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase());
            chartDataWeekly.push({
                name: days[i],
                pomodoro: 0,
                creadas: 0,
                completadas: 0
            });
        }

        // Process Pomodoro Logs -> Minutes
        let totalFocus = 0;
        pomodoroLogs.forEach(log => {
            const date = safeDate(log.createdAt);
            if (date && date >= sevenDaysAgo && date <= today) {
                const diffDays = Math.floor((date.getTime() - sevenDaysAgo.getTime()) / (1000 * 3600 * 24));
                if (diffDays >= 0 && diffDays < 7) {
                    chartDataWeekly[diffDays].pomodoro += log.durationMinutes;
                    totalFocus += log.durationMinutes;
                }
            }
        });

        // Process Tasks
        let completedWeek = 0;
        let pendingTotal = 0;
        let totalTimeTrackedSecs = 0;
        const projectTimeMap: Record<string, number> = {};

        tasks.forEach(t => {
            if (!t.completed) pendingTotal++;

            // Check completed tasks in last 7 days
            if (t.completed && t.completedAt) {
                const cDate = safeDate(t.completedAt);
                if (cDate && cDate >= sevenDaysAgo && cDate <= today) {
                    const diffDays = Math.floor((cDate.getTime() - sevenDaysAgo.getTime()) / (1000 * 3600 * 24));
                    if (diffDays >= 0 && diffDays < 7) {
                        chartDataWeekly[diffDays].completadas++;
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
                        chartDataWeekly[diffDays].creadas++;
                    }
                }
            }

            // Time distribution sum
            if (t.timeSpent && t.timeSpent > 0) {
                projectTimeMap[t.projectId] = (projectTimeMap[t.projectId] || 0) + (t.timeSpent / 3600); // to hours
                totalTimeTrackedSecs += t.timeSpent;
            }
        });

        // Time distribution array for PieChart
        const timeDistribData = Object.keys(projectTimeMap).map(pid => {
            const proj = projects.find(p => p.id === pid);
            const tailwindColor = proj ? PROJECT_COLORS[proj.color || 'gray'].dot : 'bg-gray-500';
            return {
                name: proj ? proj.name : 'General/Inbox',
                value: Number(projectTimeMap[pid].toFixed(2)),
                color: TAILWIND_HEX[tailwindColor] || '#6b7280'
            };
        }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

        // Calculate "Streak" - consecutive days with at least 1 completed task
        let streak = 0;
        for (let i = 6; i >= 0; i--) {
            if (chartDataWeekly[i].completadas > 0) streak++;
            else if (i !== 6) break; // If not today, streak broke
        }

        return {
            daysCategories: days,
            chartDataWeekly,
            timeDistribData,
            summary: {
                totalFocusHours: (totalFocus / 60).toFixed(1),
                totalTimeTrackedHours: (totalTimeTrackedSecs / 3600).toFixed(1),
                completedWeek,
                pendingTotal,
                streak
            }
        };
    }, [tasks, pomodoroLogs, projects]);

    return (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white/50 dark:bg-black/20">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="mb-2">
                    <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Analítica & Progreso</h2>
                    <p className={`text-sm font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Resumen de tu rendimiento y distribución de tiempo</p>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <ScoreCard isDark={isDark} title="Tiempo Total" value={`${summary.totalTimeTrackedHours}h`} icon={<Timer />} color="text-indigo-500" bg="bg-indigo-500/10" />
                    <ScoreCard isDark={isDark} title="Focus Pomodoro" value={`${summary.totalFocusHours}h`} icon={<Clock />} color="text-amber-500" bg="bg-amber-500/10" />
                    <ScoreCard isDark={isDark} title="Tareas Completas" subtitle="en 7 días" value={summary.completedWeek} icon={<CheckCircle2 />} color="text-emerald-500" bg="bg-emerald-500/10" />
                    <ScoreCard isDark={isDark} title="Tareas Pendientes" subtitle="Total" value={summary.pendingTotal} icon={<List />} color="text-blue-500" bg="bg-blue-500/10" />
                    <ScoreCard isDark={isDark} title="Racha Activa" subtitle="Días seguidos" value={`${summary.streak} días`} icon={<Flame />} color="text-rose-500" bg="bg-rose-500/10" />
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Time Distribution Doughnut */}
                    <div className={`p-6 rounded-2xl border lg:col-span-1 shadow-sm ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-6">
                            <PieChartIcon size={18} className="text-indigo-500" />
                            <h3 className={`font-bold tracking-tight text-sm uppercase ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Distribución de Tiempo</h3>
                        </div>
                        {timeDistribData.length > 0 ? (
                            <div className="h-64 flex flex-col">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={timeDistribData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {timeDistribData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: number) => [`${value} hrs`, 'Tiempo']}
                                            contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#18181b' : '#ffffff', color: isDark ? '#fff' : '#000', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-2 text-center text-[10px] font-bold uppercase text-zinc-500">Horas invertidas por Proyecto</div>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center opacity-50">
                                <Timer size={32} className="mb-2" />
                                <span className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Usa el cronómetro en tus tareas</span>
                            </div>
                        )}
                    </div>

                    {/* Tasks Bar Chart */}
                    <div className={`p-6 rounded-2xl border lg:col-span-2 shadow-sm ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-6">
                            <Activity size={18} className="text-emerald-500" />
                            <h3 className={`font-bold tracking-tight text-sm uppercase ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Productividad Semanal</h3>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartDataWeekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#e5e7eb'} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: isDark ? '#71717a' : '#9ca3af' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: isDark ? '#71717a' : '#9ca3af' }} />
                                    <RechartsTooltip
                                        cursor={{ fill: isDark ? '#27272a' : '#f3f4f6' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#18181b' : '#ffffff', color: isDark ? '#fff' : '#000', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, marginTop: '20px' }} />
                                    <Bar dataKey="completadas" name="Completadas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="creadas" name="Creadas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="pomodoro" name="Pomodoro (mins)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Info Note */}
                <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold uppercase tracking-wider border shadow-sm ${isDark ? 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500' : 'bg-emerald-50/50 border-emerald-100 text-emerald-700'}`}>
                    <Activity size={16} className={isDark ? 'text-zinc-600' : 'text-emerald-500'} />
                    Los datos consideran ventana de los últimos 7 días.
                </div>
            </div>
        </div>
    );
};

const ScoreCard = ({ isDark, title, subtitle, value, icon, color, bg }: any) => (
    <div className={`p-4 rounded-2xl border shadow-sm transition-all hover:-translate-y-1 cursor-default ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-100'}`}>
        <div className={`w-8 h-8 rounded-full mb-3 flex items-center justify-center ${bg} ${color}`}>
            {React.cloneElement(icon, { size: 16 })}
        </div>
        <div className={`text-2xl font-black tracking-tight mb-1 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{value}</div>
        <div className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{title}</div>
        {subtitle && <div className={`text-[9px] font-semibold mt-0.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{subtitle}</div>}
    </div>
);
