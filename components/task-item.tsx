import React from 'react';
import { GripVertical, CheckCircle2, Circle, Flag, Repeat, ClipboardList, Edit2, Trash2, AlignLeft } from 'lucide-react';
import { Task } from '../types';
import { PRIORITIES } from '../utils';
import { isOverdue, isDueToday, getDaysOpen, formatDate, safeDate } from '../utils';

export const TaskItem = ({ task, onToggle, onClick, onDelete, isDark, showProjectName, onOpenChecklist, onToggleReview, subtasksCount, subtasksCompletedCount }: {
    task: Task, onToggle: any, onClick: any, onDelete: any, isDark: boolean, showProjectName: string | null, onOpenChecklist: any, onToggleReview: any, subtasksCount?: number, subtasksCompletedCount?: number
}) => {
  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueToday = !task.completed && isDueToday(task.dueDate);
  const priorityStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
  const noteContent = task.noteContent || '';
  
  // Counts from Markdown Notes
  const noteTotalChecks = (noteContent.match(/\[ \]|\[x\]/g) || []).length;
  const noteCompletedChecks = (noteContent.match(/\[x\]/g) || []).length;
  
  // Combine with Real Child Subtasks
  const totalSubitems = noteTotalChecks + (subtasksCount || 0);
  const completedSubitems = noteCompletedChecks + (subtasksCompletedCount || 0);

  const daysOpen = getDaysOpen(task.createdAt);
  
  // Calculate if reviewed today
  const lastReviewedDate = task.lastReviewedAt ? new Date(task.lastReviewedAt) : null;
  const today = new Date();
  const isReviewedToday = lastReviewedDate && 
                          lastReviewedDate.getDate() === today.getDate() &&
                          lastReviewedDate.getMonth() === today.getMonth() &&
                          lastReviewedDate.getFullYear() === today.getFullYear();
                          
  // Completion Date Logic
  const completedDate = task.completed && task.completedAt ? safeDate(task.completedAt) : null;

  return (
    <div 
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => onClick(task)} 
        data-task-id={task.id} 
        className={`group flex items-start gap-4 p-4 rounded-xl border mb-3 cursor-pointer transition-all duration-200 ${priorityStyle.border} ${task.completed ? isDark ? 'bg-zinc-900/30 border-zinc-800/50 opacity-50' : 'bg-gray-50 border-gray-100 opacity-60' : isDark ? 'bg-[#18181b] border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-200 hover:border-emerald-200'}`}
    >
      <div className={`mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-300'} cursor-move opacity-0 group-hover:opacity-50 hover:opacity-100`}><GripVertical size={16} /></div>
      
      {/* Daily Review Dot */}
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleReview(task); }}
        className={`mt-2 w-2 h-2 rounded-full transition-colors ${isReviewedToday ? 'bg-emerald-500' : isDark ? 'bg-zinc-700 hover:bg-zinc-500' : 'bg-gray-300 hover:bg-gray-400'}`}
        title={isReviewedToday ? "Revisado hoy" : "Marcar como revisado"}
      />

      <button onClick={(e) => { e.stopPropagation(); onToggle(task); }} className={`mt-0.5 flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : overdue ? 'text-red-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>{task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}</button>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[15px] font-medium transition-all ${task.completed ? isDark ? 'text-zinc-500 line-through' : 'text-gray-400 line-through' : isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{task.title}</span>
            <div className="flex items-center gap-2">
                {task.priority && task.priority !== 'none' && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${priorityStyle.bg} ${priorityStyle.color} border-transparent`}><Flag size={10} className={priorityStyle.iconColor} />{priorityStyle.label}</span>)}
                {showProjectName && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{showProjectName}</span>)}
                
                {/* Due Date Badge (Only if not completed) */}
                {task.dueDate && !task.completed && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${overdue ? 'bg-red-500/10 text-red-500 border-red-500/20' : dueToday ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : isDark ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{formatDate(task.dueDate)} {task.dueTime && <span className="opacity-70 ml-1">{task.dueTime}</span>}</span>}
                
                {/* Completion Date Badge (Only if completed) */}
                {completedDate && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} title={`Completado: ${completedDate.toLocaleString()}`}>
                        <CheckCircle2 size={10} /> {completedDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                    </span>
                )}

                {daysOpen > 0 && !task.completed && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-gray-100 border-gray-200 text-gray-500'}`} title="Días desde creación">
                        {daysOpen}d
                    </div>
                )}
                {task.recurrence && task.recurrence !== 'none' && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'}`} title="Tarea recurrente">
                        <Repeat size={10} />
                    </div>
                )}
                {totalSubitems > 0 && (
                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                       <ClipboardList size={10} /> {completedSubitems}/{totalSubitems}
                   </span>
                )}
            </div>
        </div>
        {task.description && (
            <div className={`flex items-start gap-1.5 text-xs leading-relaxed ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                 <AlignLeft size={12} className="mt-0.5 opacity-50 flex-shrink-0" />
                 <span className="line-clamp-2">{task.description}</span>
            </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onOpenChecklist(task); }} className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-500'}`} title="Notas"><ClipboardList size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); onClick(task); }} className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-700'}`}><Edit2 size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={16} /></button>
      </div>
    </div>
  );
};