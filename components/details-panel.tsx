import React, { useState, useRef } from 'react';
import { X, CheckCircle2, Circle, Flag, Calendar as CalendarIcon, Repeat, ClipboardList, Plus, Trash2, ArrowDownToLine, Image as ImageIcon, Upload } from 'lucide-react';
import { Task } from '../types';
import { PRIORITIES, TIME_SLOTS, RECURRENCE_OPTIONS, formatCreationDate, getEndTime, calculateDuration } from '../utils';
import { CustomTimeSelect, CustomSelect } from './ui-elements';

interface DetailsPanelProps {
    editingTask: Task | null;
    setEditingTask: (t: Task | null) => void;
    isDark: boolean;
    handleToggleTask: (t: Task) => void;
    handleUpdateTaskDetail: (field: keyof Task, value: any) => void;
    handleDeleteTask: (id: string) => void;
    currentTaskSubtasks: Task[];
    handleAddSubtask: (e: React.FormEvent) => void;
    setChecklistModalTask: (t: Task) => void;
    panelRef: React.RefObject<HTMLDivElement | null>;
    onReparentTask?: (childId: string, parentId: string) => void;
}

export const DetailsPanel = ({
    editingTask, setEditingTask, isDark, handleToggleTask, handleUpdateTaskDetail,
    handleDeleteTask, currentTaskSubtasks, handleAddSubtask, setChecklistModalTask, panelRef, onReparentTask
}: DetailsPanelProps) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const childTaskId = e.dataTransfer.getData('taskId');
        
        if (childTaskId && editingTask && childTaskId !== editingTask.id && onReparentTask) {
            onReparentTask(childTaskId, editingTask.id);
        }
    };

    // --- Image Handling ---
    const processImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                handleUpdateTaskDetail('attachment', e.target.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) processImageFile(blob);
                e.preventDefault(); // Prevent pasting the binary name text into textarea
                break;
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0]);
        }
    };

    return (
        <div ref={panelRef} className={`absolute inset-y-0 right-0 w-[400px] border-l shadow-2xl transform transition-transform duration-300 z-30 flex flex-col ${editingTask ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
            {editingTask && (
            <>
                <div className={`p-5 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Detalles</span>
                    <button onClick={() => setEditingTask(null)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="flex items-start gap-3 mb-6">
                        <button onClick={() => handleToggleTask(editingTask)} className={`mt-1 flex-shrink-0 ${editingTask.completed ? 'text-emerald-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>
                            {editingTask.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                        </button>
                        <textarea 
                            value={editingTask.title} 
                            onChange={(e) => handleUpdateTaskDetail('title', e.target.value)} 
                            className={`w-full bg-transparent text-xl font-semibold border-none outline-none resize-none h-auto min-h-[3rem] p-0 leading-tight ${isDark ? 'text-zinc-100 placeholder-zinc-600' : 'text-gray-800 placeholder-gray-400'}`} 
                            rows={2} 
                            placeholder="Título de la tarea" 
                        />
                    </div>
                    
                    <div className="mb-6">
                        <label className={`text-[10px] font-bold uppercase mb-2 block ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Prioridad</label>
                        <div className="flex gap-2">
                            {['low', 'medium', 'high'].map((level) => { 
                                const p = PRIORITIES[level]; 
                                const isSelected = editingTask.priority === level; 
                                return (
                                    <button key={level} onClick={() => handleUpdateTaskDetail('priority', level)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${isSelected ? `${p.bg} ${p.color} ${p.border.replace('border-l-4', 'border')}` : `border-transparent ${isDark ? 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}`}>
                                        <Flag size={12} className={isSelected ? p.iconColor : 'fill-transparent'} /> {p.label}
                                    </button>
                                ); 
                            })}
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}>
                            <label className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                <CalendarIcon size={10} /> Fecha & Horario
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={editingTask.dueDate || ''} 
                                    onChange={(e) => handleUpdateTaskDetail('dueDate', e.target.value)} 
                                    className={`bg-transparent text-xs outline-none font-medium flex-1 min-w-0 ${isDark ? 'text-zinc-200 [color-scheme:dark]' : 'text-gray-700 [color-scheme:light]'}`} 
                                />
                                <div className={`w-px h-4 mx-1 ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                                <div className="flex items-center gap-1">
                                    <CustomTimeSelect 
                                    value={editingTask.dueTime}
                                    onChange={(val: string) => handleUpdateTaskDetail('dueTime', val)}
                                    options={TIME_SLOTS}
                                    isDark={isDark}
                                    placeholder="--:--"
                                    />
                                    <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>-</span>
                                    <CustomTimeSelect 
                                        value={getEndTime(editingTask.dueTime || '08:00', editingTask.duration || 60)}
                                        onChange={(val: string) => {
                                            const newDuration = calculateDuration(editingTask.dueTime || '08:00', val);
                                            handleUpdateTaskDetail('duration', newDuration);
                                        }}
                                        options={TIME_SLOTS}
                                        isDark={isDark}
                                        disabled={!editingTask.dueTime}
                                        placeholder="--:--"
                                        />
                                </div>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}>
                            <label className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                <Repeat size={10} /> Repetir
                            </label>
                            <CustomSelect 
                                value={editingTask.recurrence || 'none'}
                                onChange={(val: string) => handleUpdateTaskDetail('recurrence', val)}
                                options={Object.values(RECURRENCE_OPTIONS)}
                                isDark={isDark}
                            />
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Notas / Descripción</label>
                                <button
                                onClick={() => setChecklistModalTask(editingTask)}
                                className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-black'}`}
                            >
                                <ClipboardList size={12} /> Abrir Notas Completas
                            </button>
                        </div>
                        <div 
                            className={`w-full rounded-lg p-3 border transition-colors min-h-[250px] flex flex-col ${isDark ? 'bg-zinc-900/50 border-zinc-800/50 focus-within:border-emerald-500/50' : 'bg-gray-50 border-gray-100 focus-within:border-emerald-400'}`}
                        >
                            <textarea 
                                value={editingTask.description} 
                                onChange={(e) => handleUpdateTaskDetail('description', e.target.value)} 
                                onPaste={handlePaste}
                                className={`w-full bg-transparent outline-none text-sm resize-none flex-1 ${isDark ? 'text-zinc-300 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`} 
                                placeholder="Añadir descripción o pega (Ctrl+V) una imagen..." 
                            />
                            
                            {/* ATTACHMENT PREVIEW AREA */}
                            {editingTask.attachment && (
                                <div className="mt-3 relative group">
                                    <img src={editingTask.attachment} alt="Adjunto" className="w-full h-auto rounded-lg border dark:border-zinc-700" />
                                    <button 
                                        onClick={() => handleUpdateTaskDetail('attachment', null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                        title="Eliminar imagen"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                            
                            {/* UPLOAD BUTTON */}
                            <div className="mt-2 flex justify-end">
                                <label className={`cursor-pointer p-1.5 rounded transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`} title="Adjuntar imagen">
                                    <ImageIcon size={16} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} ref={fileInputRef} />
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Subtareas</label>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>{currentTaskSubtasks.length}</span>
                        </div>
                        
                        {/* DROP ZONE CONTAINER */}
                        <div 
                            className={`space-y-1 mb-3 rounded-lg transition-all duration-300 ${isDragOver ? (isDark ? 'bg-emerald-500/10 border-emerald-500/50 border-2 border-dashed p-4 min-h-[60px]' : 'bg-emerald-50 border-emerald-300 border-2 border-dashed p-4 min-h-[60px]') : 'border-2 border-transparent'}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {isDragOver && (
                                <div className="flex items-center justify-center h-full text-emerald-500 gap-2 text-sm font-medium pointer-events-none">
                                    <ArrowDownToLine size={18} /> Soltar para asignar
                                </div>
                            )}

                            {!isDragOver && currentTaskSubtasks.map((sub) => (
                                <div key={sub.id} className={`group flex items-center gap-2 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50'}`}>
                                    <button onClick={() => handleToggleTask(sub)} className={`${sub.completed ? 'text-emerald-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>
                                        {sub.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                    </button>
                                    <span className={`text-sm flex-1 ${sub.completed ? isDark ? 'text-zinc-600 line-through' : 'text-gray-400 line-through' : isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{sub.title}</span>
                                    <button onClick={() => handleDeleteTask(sub.id)} className={`p-1.5 rounded opacity-0 group-hover:opacity-100 ${isDark ? 'text-zinc-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={12} /></button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleAddSubtask} className={`flex items-center gap-2 text-sm pl-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                            <Plus size={16} />
                            <input name="subtaskTitle" placeholder="Añadir paso..." className={`bg-transparent outline-none flex-1 py-2 ${isDark ? 'placeholder-zinc-600 text-zinc-300' : 'placeholder-gray-400 text-gray-700'}`} autoComplete="off" />
                        </form>
                    </div>
                </div>
                
                {/* CREATION/COMPLETION DATE FOOTER */}
                <div className={`p-4 border-t text-xs flex justify-between items-center ${isDark ? 'border-zinc-800 text-zinc-600' : 'border-gray-100 text-gray-400'}`}>
                    <div className="flex flex-col gap-0.5">
                        <span>Creado el {formatCreationDate(editingTask.createdAt)}</span>
                        {editingTask.completed && editingTask.completedAt && (
                            <span className="text-emerald-500 font-medium">Completado el {formatCreationDate(editingTask.completedAt)}</span>
                        )}
                    </div>
                    <button onClick={() => handleDeleteTask(editingTask.id)} className="text-red-400 hover:text-red-300 flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={14} /> Eliminar</button>
                </div>
            </>
            )}
        </div>
    );
};