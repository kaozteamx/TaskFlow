import React, { useMemo, useState } from 'react';
import { Plus, MoreHorizontal, Calendar, Flag, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Task, Project } from '../types';
import { PRIORITIES, formatDate, isOverdue, PROJECT_COLORS } from '../utils';

interface KanbanBoardProps {
    tasks: Task[];
    projects: Project[];
    isDark: boolean;
    onUpdateStatus: (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => void;
    onEditTask: (task: Task) => void;
    onQuickAdd: (status: 'todo' | 'in_progress') => void;
}

export const KanbanBoard = ({ tasks, projects, isDark, onUpdateStatus, onEditTask, onQuickAdd }: KanbanBoardProps) => {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Filter tasks for the current view (already filtered by project in App.tsx)
    const columns = useMemo(() => {
        const todo = tasks.filter(t => !t.completed && (!t.status || t.status === 'todo'));
        const inProgress = tasks.filter(t => !t.completed && t.status === 'in_progress');
        const done = tasks.filter(t => t.completed || t.status === 'done'); // completed takes precedence

        return {
            todo: { title: 'Por hacer', tasks: todo, id: 'todo', color: 'bg-gray-500' },
            in_progress: { title: 'En Progreso', tasks: inProgress, id: 'in_progress', color: 'bg-blue-500' },
            done: { title: 'Completado', tasks: done, id: 'done', color: 'bg-emerald-500' }
        };
    }, [tasks]);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (taskId) {
            onUpdateStatus(taskId, status);
        }
        setDraggedTaskId(null);
    };

    return (
        <div className="flex-1 overflow-x-auto overflow-y-hidden h-full p-6">
            <div className="flex h-full gap-6 min-w-[900px]">
                {(Object.keys(columns) as Array<keyof typeof columns>).map((colKey) => {
                    const column = columns[colKey];
                    return (
                        <div 
                            key={column.id}
                            className={`flex-1 flex flex-col rounded-xl border transition-colors ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-gray-50/50 border-gray-200'}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.id as any)}
                        >
                            {/* Column Header */}
                            <div className="p-4 flex items-center justify-between border-b border-inherit">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                                    <span className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{column.title}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-200 text-gray-500'}`}>
                                        {column.tasks.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {colKey !== 'done' && (
                                        <button 
                                            onClick={() => onQuickAdd(colKey as any)}
                                            className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Drop Zone / Task List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                                {column.tasks.map(task => (
                                    <KanbanCard 
                                        key={task.id} 
                                        task={task} 
                                        isDark={isDark} 
                                        projects={projects}
                                        onDragStart={handleDragStart}
                                        onClick={() => onEditTask(task)}
                                    />
                                ))}
                                {column.tasks.length === 0 && (
                                    <div className={`h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-xs ${isDark ? 'border-zinc-800 text-zinc-700' : 'border-gray-200 text-gray-400'}`}>
                                        Arrastra tareas aquí
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const KanbanCard = ({ task, isDark, projects, onDragStart, onClick }: any) => {
    const overdue = !task.completed && isOverdue(task.dueDate);
    const priorityStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
    const project = projects.find((p: any) => p.id === task.projectId);
    const projectColor = PROJECT_COLORS[project?.color || 'gray'];

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onClick={onClick}
            className={`p-3 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${
                task.completed ? 'opacity-60' : ''
            } ${
                isDark 
                    ? 'bg-[#18181b] border-zinc-800 hover:border-zinc-700' 
                    : 'bg-white border-gray-200 hover:border-emerald-300'
            }`}
        >
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-medium line-clamp-2 leading-relaxed ${isDark ? 'text-zinc-200' : 'text-gray-700'} ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                </span>
                {task.priority !== 'none' && (
                    <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${priorityStyle.bg.replace('/10', '')} ${priorityStyle.color.replace('text-', 'bg-')}`} />
                )}
            </div>

            <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                     {/* Project Tag */}
                    {project && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                            <div className={`w-1 h-1 rounded-full ${projectColor.dot}`} />
                            <span className="truncate max-w-[60px]">{project.name}</span>
                        </div>
                    )}
                </div>
                
                {/* Date Tag */}
                {task.dueDate && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${
                        overdue ? 'text-red-500' : isDark ? 'text-zinc-500' : 'text-gray-400'
                    }`}>
                        <Calendar size={10} />
                        {formatDate(task.dueDate)}
                    </div>
                )}
            </div>
        </div>
    );
};