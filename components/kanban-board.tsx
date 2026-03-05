import React, { useMemo, useState } from 'react';
import { Plus, Calendar, CheckCircle2, Circle, Clock, Flame, CalendarClock, Users, Trash } from 'lucide-react';
import { Task, Project } from '../types';
import { PRIORITIES, formatDate, isOverdue, PROJECT_COLORS } from '../utils';

interface EisenhowerMatrixProps {
    tasks: Task[];
    projects: Project[];
    isDark: boolean;
    onUpdateStatus: (taskId: string, newStatus: 'do_first' | 'schedule' | 'delegate' | 'eliminate') => void;
    onEditTask: (task: Task) => void;
    onQuickAdd: (status: 'do_first' | 'schedule' | 'delegate' | 'eliminate', title: string) => void;
}

export const KanbanBoard = ({ tasks, projects, isDark, onUpdateStatus, onEditTask, onQuickAdd }: EisenhowerMatrixProps) => {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [addingToQuadrant, setAddingToQuadrant] = useState<'do_first' | 'schedule' | 'delegate' | 'eliminate' | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const handleQuickSubmit = (e: React.FormEvent, status: 'do_first' | 'schedule' | 'delegate' | 'eliminate') => {
        e.preventDefault();
        if (newTaskTitle.trim()) {
            onQuickAdd(status, newTaskTitle);
            setNewTaskTitle('');
            setAddingToQuadrant(null);
        }
    };

    // Filter tasks for the current view (already filtered by project in App.tsx)
    const quadrants = useMemo(() => {
        // Map any old status to do_first as default fallback
        const doFirst = tasks.filter(t => !t.completed && (t.status === 'do_first' || !t.status || t.status === 'todo' || t.status === 'in_progress'));
        const schedule = tasks.filter(t => !t.completed && t.status === 'schedule');
        const delegate = tasks.filter(t => !t.completed && t.status === 'delegate');
        const eliminate = tasks.filter(t => !t.completed && t.status === 'eliminate');

        return {
            do_first: {
                title: 'Hacer Ya', subtitle: 'Urgente e Importante', tasks: doFirst, id: 'do_first',
                icon: <Flame size={16} className="text-red-500" />,
                borderClass: isDark ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50' : 'border-red-200 bg-red-50 hover:border-red-300'
            },
            schedule: {
                title: 'Agendar', subtitle: 'Importante, No Urgente', tasks: schedule, id: 'schedule',
                icon: <CalendarClock size={16} className="text-blue-500" />,
                borderClass: isDark ? 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50' : 'border-blue-200 bg-blue-50 hover:border-blue-300'
            },
            delegate: {
                title: 'Delegar', subtitle: 'Urgente, No Importante', tasks: delegate, id: 'delegate',
                icon: <Users size={16} className="text-amber-500" />,
                borderClass: isDark ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50' : 'border-amber-200 bg-amber-50 hover:border-amber-300'
            },
            eliminate: {
                title: 'Eliminar / Posponer', subtitle: 'Ni Urgente Ni Importante', tasks: eliminate, id: 'eliminate',
                icon: <Trash size={16} className="text-zinc-500" />,
                borderClass: isDark ? 'border-zinc-700 bg-zinc-800/20 hover:border-zinc-500' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }
        };
    }, [tasks, isDark]);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, status: 'do_first' | 'schedule' | 'delegate' | 'eliminate') => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            onUpdateStatus(taskId, status);
        }
        setDraggedTaskId(null);
    };

    return (
        <div className="flex-1 overflow-hidden h-full p-6">
            <div className="grid grid-cols-2 grid-rows-2 gap-6 h-full min-w-[800px]">
                {(Object.keys(quadrants) as Array<keyof typeof quadrants>).map((colKey) => {
                    const column = quadrants[colKey];
                    return (
                        <div
                            key={column.id}
                            className={`flex flex-col rounded-2xl border-2 transition-colors ${column.borderClass} overflow-hidden`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id as any)}
                        >
                            {/* Header */}
                            <div className="p-4 flex flex-col gap-1 border-b border-inherit bg-white/5 dark:bg-black/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {column.icon}
                                        <span className={`text-base font-black uppercase tracking-tight ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                            {column.title}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setAddingToQuadrant(colKey as any);
                                            setNewTaskTitle('');
                                        }}
                                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`}
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                        {column.subtitle}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-black/20 text-zinc-400' : 'bg-black/5 text-gray-500'}`}>
                                        {column.tasks.length} tareas
                                    </span>
                                </div>
                            </div>

                            {/* Task List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                                {addingToQuadrant === colKey && (
                                    <form onSubmit={(e) => handleQuickSubmit(e, colKey as any)} className={`p-3 rounded-xl border shadow-lg ${isDark ? 'bg-[#18181b] border-emerald-500/50' : 'bg-white border-emerald-400'}`}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            onBlur={() => setAddingToQuadrant(null)}
                                            placeholder="Añadir tarea..."
                                            className={`w-full bg-transparent outline-none text-[13px] font-medium ${isDark ? 'text-zinc-200 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`}
                                        />
                                    </form>
                                )}
                                <div className={column.tasks.length === 0 ? 'h-full flex items-center justify-center opacity-50' : ''}>
                                    {column.tasks.map(task => (
                                        <EisenhowerCard
                                            key={task.id}
                                            task={task}
                                            isDark={isDark}
                                            projects={projects}
                                            onDragStart={handleDragStart}
                                            onClick={() => onEditTask(task)}
                                        />
                                    ))}
                                    {column.tasks.length === 0 && !addingToQuadrant && (
                                        <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                            Arrastra o pulsa "+"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const EisenhowerCard = ({ task, isDark, projects, onDragStart, onClick }: any) => {
    const overdue = !task.completed && isOverdue(task.dueDate);
    const project = projects.find((p: any) => p.id === task.projectId);
    const projectColor = PROJECT_COLORS[project?.color || 'gray'];

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={onClick}
            className={`p-3.5 mb-3 rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${isDark
                ? 'bg-[#18181b] border-zinc-700 hover:border-zinc-500'
                : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
        >
            <div className="flex justify-between items-start gap-4">
                <span className={`text-[13px] font-semibold line-clamp-2 leading-snug ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                    {task.title}
                </span>
                {task.priority !== 'none' && (
                    <div className={`flex-shrink-0 w-2 h-2 mt-1 rounded-full ${task.priority === 'high' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                )}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-inherit/30">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Project Tag */}
                    {project && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-gray-50 border-gray-100 text-gray-500'} truncate`}>
                            <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${projectColor.dot}`} />
                            <span className="truncate">{project.name}</span>
                        </div>
                    )}
                </div>

                {/* Date Tag */}
                {task.dueDate && (
                    <div className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${overdue ? 'bg-red-500/10 text-red-500' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'
                        }`}>
                        <Calendar size={12} />
                        {formatDate(task.dueDate)}
                    </div>
                )}
            </div>
        </div>
    );
};