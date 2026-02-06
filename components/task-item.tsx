import React, { useState } from 'react';
import {
    CheckCircle2, Circle, Flag, Repeat, ClipboardList, Edit2,
    Trash2, AlignLeft, Image as ImageIcon, ChevronRight,
    ChevronDown, MoreVertical, Calendar, Clock
} from 'lucide-react';
import { Task } from '../types';
import { PRIORITIES } from '../utils';
import { isOverdue, isDueToday, getDaysOpen, formatDate, safeDate } from '../utils';

interface TaskItemProps {
    task: Task;
    onToggle: (task: Task) => void;
    onClick: (task: Task) => void;
    onDelete: (id: string) => void;
    isDark: boolean;
    showProjectName: string;
    onOpenChecklist: (task: Task) => void;
    onToggleReview: (task: Task) => void;
    subtasksCount?: number;
    subtasksCompletedCount?: number;
    subtasks?: Task[];
    depth?: number;
}

export const TaskItem: React.FC<TaskItemProps> = ({
    task,
    onToggle,
    onClick,
    onDelete,
    isDark,
    showProjectName,
    onOpenChecklist,
    onToggleReview,
    subtasksCount = 0,
    subtasksCompletedCount = 0,
    subtasks = [],
    depth = 0
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const overdue = !task.completed && isOverdue(task.dueDate);
    const dueToday = !task.completed && isDueToday(task.dueDate);
    const priorityStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
    const noteContent = task.noteContent || '';

    // Counts from Markdown Notes
    const noteTotalChecks = (noteContent.match(/\[ \]|\[x\]/g) || []).length;
    const noteCompletedChecks = (noteContent.match(/\[x\]/g) || []).length;

    // Combine with Real Child Subtasks
    const totalSubitems = noteTotalChecks + subtasksCount;
    const completedSubitems = noteCompletedChecks + subtasksCompletedCount;
    const hasSubtasks = totalSubitems > 0;

    const daysOpen = getDaysOpen(task.createdAt);
    const completedDate = task.completed && task.completedAt ? safeDate(task.completedAt) : null;

    // Calculate if reviewed today
    const lastReviewedDate = task.lastReviewedAt ? new Date(task.lastReviewedAt) : null;
    const today = new Date();
    const isReviewedToday = lastReviewedDate &&
        lastReviewedDate.getDate() === today.getDate() &&
        lastReviewedDate.getMonth() === today.getMonth() &&
        lastReviewedDate.getFullYear() === today.getFullYear();

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasSubtasks) {
            setIsExpanded(!isExpanded);
        }
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    // Indentation for subtask hierarchy
    const paddingLeft = depth * 32;

    return (
        <>
            <div
                draggable={true}
                onDragStart={handleDragStart}
                onClick={() => onClick(task)}
                data-task-id={task.id}
                style={{ paddingLeft: `${paddingLeft}px` }}
                className={`
          group relative flex items-center gap-3 py-2.5 px-4 
          transition-all duration-200 cursor-pointer
          border-l-2 mb-1
          ${task.completed
                        ? isDark
                            ? 'bg-zinc-900/30 border-zinc-800 opacity-50 hover:bg-zinc-900/40'
                            : 'bg-gray-50/50 border-gray-200 opacity-60 hover:bg-gray-50'
                        : isDark
                            ? 'bg-transparent border-transparent hover:bg-zinc-900/50 hover:border-zinc-800'
                            : 'bg-transparent border-transparent hover:bg-gray-50/80 hover:border-gray-300'
                    }
          ${overdue && !task.completed ? 'border-l-red-500' : ''}
          ${dueToday && !task.completed ? 'border-l-amber-500' : ''}
        `}
            >
                {/* Expand/Collapse button */}
                {hasSubtasks && (
                    <button
                        onClick={toggleExpand}
                        className={`
              flex-shrink-0 transition-all duration-200 
              ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600'}
            `}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}

                {/* Daily Review Dot */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleReview(task); }}
                    className={`
            flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-200
            ${isReviewedToday
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : isDark
                                ? 'bg-zinc-700/50 hover:bg-zinc-600'
                                : 'bg-gray-300 hover:bg-gray-400'
                        }
            ${!hasSubtasks ? 'ml-5' : ''}
          `}
                    title={isReviewedToday ? "Revisado hoy" : "Marcar como revisado"}
                />

                {/* Checkbox */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(task); }}
                    className={`
            flex-shrink-0 transition-all duration-200 
            ${task.completed
                            ? 'text-emerald-500'
                            : overdue
                                ? 'text-red-500 hover:text-red-400'
                                : isDark
                                    ? 'text-zinc-700 hover:text-emerald-500'
                                    : 'text-gray-300 hover:text-emerald-500'
                        }
          `}
                >
                    {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Title and badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`
              text-[15px] font-normal transition-all 
              ${task.completed
                                ? isDark
                                    ? 'text-zinc-600 line-through'
                                    : 'text-gray-400 line-through'
                                : isDark
                                    ? 'text-zinc-200'
                                    : 'text-gray-800'
                            }
            `}>
                            {task.title}
                        </span>

                        {/* Compact badges container */}
                        <div className="flex items-center gap-1.5">
                            {/* Priority Flag Icon */}
                            {task.priority && task.priority !== 'none' && (
                                <Flag
                                    size={12}
                                    className={`
                    ${task.priority === 'high' ? 'text-red-500' : ''}
                    ${task.priority === 'medium' ? 'text-amber-500' : ''}
                    ${task.priority === 'low' ? 'text-blue-500' : ''}
                  `}
                                    fill="currentColor"
                                />
                            )}

                            {/* Subtasks count */}
                            {totalSubitems > 0 && (
                                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded
                  ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}
                `}>
                                    {completedSubitems}/{totalSubitems}
                                </span>
                            )}

                            {/* Due date/time */}
                            {task.dueDate && !task.completed && (
                                <div className={`
                  flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded
                  ${overdue
                                        ? 'bg-red-500/10 text-red-500'
                                        : dueToday
                                            ? 'bg-amber-500/10 text-amber-500'
                                            : isDark
                                                ? 'bg-zinc-800 text-zinc-500'
                                                : 'bg-gray-100 text-gray-500'
                                    }
                `}>
                                    <Calendar size={10} />
                                    {formatDate(task.dueDate)}
                                    {task.dueTime && (
                                        <>
                                            <Clock size={10} className="ml-0.5" />
                                            {task.dueTime}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Completion date */}
                            {completedDate && (
                                <div className={`
                  flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded
                  ${isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}
                `}>
                                    <CheckCircle2 size={10} />
                                    {completedDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                                </div>
                            )}

                            {/* Recurrence */}
                            {task.recurrence && task.recurrence !== 'none' && (
                                <Repeat size={12} className={isDark ? 'text-blue-400' : 'text-blue-500'} />
                            )}

                            {/* Attachment */}
                            {task.attachment && (
                                <ImageIcon size={12} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                            )}

                            {/* Project name */}
                            {showProjectName && (
                                <span className={`
                  text-[10px] px-1.5 py-0.5 rounded
                  ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}
                `}>
                                    {showProjectName}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description preview */}
                    {task.description && (
                        <div className={`
              flex items-start gap-1.5 text-[13px] leading-relaxed
              ${isDark ? 'text-zinc-600' : 'text-gray-500'}
            `}>
                            <AlignLeft size={12} className="mt-0.5 opacity-50 flex-shrink-0" />
                            <span className="line-clamp-1">{task.description}</span>
                        </div>
                    )}
                </div>

                {/* Actions Menu (appears on hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenChecklist(task); }}
                        className={`
              p-1.5 rounded transition-colors
              ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-purple-400' : 'hover:bg-gray-100 text-gray-400 hover:text-purple-500'}
            `}
                        title="Notas"
                    >
                        <ClipboardList size={16} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onClick(task); }}
                        className={`
              p-1.5 rounded transition-colors
              ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}
            `}
                        title="Editar"
                    >
                        <Edit2 size={16} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                        className={`
              p-1.5 rounded transition-colors
              ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-red-400' : 'hover:bg-gray-100 text-gray-400 hover:text-red-500'}
            `}
                        title="Eliminar"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Subtasks - Rendered recursively */}
            {isExpanded && subtasks.length > 0 && (
                <div className="animate-fade-in">
                    {subtasks.map(subtask => (
                        <TaskItem
                            key={subtask.id}
                            task={subtask}
                            onToggle={onToggle}
                            onClick={onClick}
                            onDelete={onDelete}
                            isDark={isDark}
                            showProjectName=""
                            onOpenChecklist={onOpenChecklist}
                            onToggleReview={onToggleReview}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </>
    );
};