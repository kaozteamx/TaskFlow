import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task, Project } from '../types';
import { PRIORITIES, getMonday, isDueToday, getEndTime, PROJECT_COLORS } from '../utils';

export const CalendarBoard = ({ 
    tasks, 
    projects, 
    onUpdateTask, 
    onUpdateTaskTime,
    isDark, 
    onEditTask,
}: { 
    tasks: Task[], 
    projects: Project[], 
    onUpdateTask: (id: string, date: string | null) => void, 
    onUpdateTaskTime: (id: string, date: string, time: string, duration: number) => void,
    isDark: boolean, 
    onEditTask: (t: Task) => void,
}) => {
    const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [visibleProjects, setVisibleProjects] = useState<Record<string, boolean>>({});
    const [isBacklogOpen, setIsBacklogOpen] = useState(true);
    const [isAllDayExpanded, setIsAllDayExpanded] = useState(true);
    
    // Resize State
    const [resizingTask, setResizingTask] = useState<string | null>(null);
    const [resizeStartY, setResizeStartY] = useState<number>(0);
    const [resizeStartHeight, setResizeStartHeight] = useState<number>(0);
    const [tempHeight, setTempHeight] = useState<number | null>(null);

    useEffect(() => {
        const initExp: any = {};
        const initVis: any = {};
        projects.forEach(p => { initExp[p.id] = true; initVis[p.id] = true; });
        setExpandedProjects(prev => ({...initExp, ...prev}));
        setVisibleProjects(prev => ({...initVis, ...prev}));
    }, [projects]);

    const toggleProject = (pid: string) => setExpandedProjects(prev => ({...prev, [pid]: !prev[pid]}));
    const toggleProjectVisibility = (pid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setVisibleProjects(prev => ({...prev, [pid]: !prev[pid]}));
    };
    
    const weekDays = useMemo(() => {
        const days = [];
        const start = new Date(currentWeekStart);
        // Only Mon-Fri (5 days)
        for(let i=0; i<5; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentWeekStart]);

    // Generate hours 00:00 - 23:00
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const PIXELS_PER_HOUR = 60;
    const PIXELS_PER_15_MIN = PIXELS_PER_HOUR / 4;

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData("taskId", taskId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDropOnBacklog = (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if(taskId) {
            onUpdateTask(taskId, null); // Clear date
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDropOnAllDay = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if(taskId) {
             const dateStr = date.toISOString().split('T')[0];
             onUpdateTaskTime(taskId, dateStr, '', 0); 
        }
    };

    const handleDropOnDayGrid = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if(taskId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const offsetY = e.clientY - rect.top;
            
            const totalMinutes = (offsetY / PIXELS_PER_HOUR) * 60;
            const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
            
            const hours = Math.floor(snappedMinutes / 60);
            const minutes = snappedMinutes % 60;
            const clampedHours = Math.max(0, Math.min(23, hours));
            const timeStr = `${clampedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            const dateStr = date.toISOString().split('T')[0];

            const task = tasks.find(t => t.id === taskId);
            const duration = task?.duration || 60;

            onUpdateTaskTime(taskId, dateStr, timeStr, duration);
        }
    };

    const handleResizeStart = (e: React.MouseEvent, taskId: string, currentDuration: number) => {
        e.stopPropagation();
        setResizingTask(taskId);
        setResizeStartY(e.clientY);
        setResizeStartHeight((currentDuration / 60) * PIXELS_PER_HOUR);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingTask) {
                const deltaY = e.clientY - resizeStartY;
                const newHeight = Math.max(PIXELS_PER_15_MIN, resizeStartHeight + deltaY); 
                setTempHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            if (resizingTask) {
                if (tempHeight !== null) {
                    const newMinutes = Math.round((tempHeight / PIXELS_PER_HOUR) * 60 / 15) * 15;
                    const task = tasks.find(t => t.id === resizingTask);
                    if (task && task.dueDate && task.dueTime) {
                        onUpdateTaskTime(task.id, task.dueDate, task.dueTime, newMinutes);
                    }
                }
                setResizingTask(null);
                setTempHeight(null);
            }
        };

        if (resizingTask) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
    }, [resizingTask, resizeStartY, resizeStartHeight, tempHeight, tasks, PIXELS_PER_HOUR]);

    const weekStartStr = currentWeekStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    const weekEnd = new Date(currentWeekStart); weekEnd.setDate(weekEnd.getDate()+4);
    const weekEndStr = weekEnd.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

    const visibleTasks = tasks.filter(t => visibleProjects[t.projectId]);

    const BacklogTaskCard = ({ task }: { task: Task }) => {
        const pStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
        const project = projects.find(p => p.id === task.projectId);
        const colorStyle = PROJECT_COLORS[project?.color || 'gray'];

        return (
            <div 
                draggable 
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onClick={() => onEditTask(task)}
                className={`p-2 mb-2 rounded-lg border text-xs cursor-move hover:shadow-md transition-all select-none ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700' : 'bg-white border-gray-200 hover:border-emerald-300'} ${task.completed ? 'opacity-50' : ''}`}
                style={isDark ? {} : { borderLeftColor: colorStyle ? colorStyle.dot.replace('bg-', '') : undefined, borderLeftWidth: '4px' }}
            >
                <div className="flex items-start gap-2">
                    {isDark && <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorStyle ? colorStyle.dot : 'bg-zinc-500'}`} />}
                    <span className={`line-clamp-2 ${isDark ? 'text-zinc-200' : 'text-gray-700'} ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                    </span>
                </div>
            </div>
        );
    };

    const TimeGridTask = ({ task }: { task: Task }) => {
        let top = 0;
        if (task.dueTime) {
            const [h, m] = task.dueTime.split(':').map(Number);
            top = (h * 60 + m) * (PIXELS_PER_HOUR / 60);
        }
        let height = (task.duration || 60) * (PIXELS_PER_HOUR / 60);
        if (resizingTask === task.id && tempHeight !== null) {
            height = tempHeight;
        }

        const project = projects.find(p => p.id === task.projectId);
        const colorStyle = PROJECT_COLORS[project?.color || 'gray'];

        return (
            <div
                draggable={resizingTask !== task.id}
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                style={{ top: `${top}px`, height: `${height}px` }}
                className={`absolute left-0.5 right-1 rounded border text-[10px] select-none group z-10 overflow-hidden flex flex-col ${colorStyle.bg} ${colorStyle.border} ${task.completed ? 'opacity-60' : ''} ${resizingTask ? 'pointer-events-none' : ''}`}
            >
                <div className="pl-2 pr-1 py-1 flex-1 min-h-0">
                    <div className={`font-bold truncate leading-tight ${colorStyle.text}`}>{task.title}</div>
                    {height > 30 && <div className={`truncate opacity-70 ${colorStyle.text}`}>{task.dueTime} - {getEndTime(task.dueTime || '00:00', task.duration || 60)}</div>}
                </div>
                <div 
                    onMouseDown={(e) => handleResizeStart(e, task.id, task.duration || 60)}
                    className="h-2 w-full cursor-s-resize absolute bottom-0 left-0 flex justify-center items-end opacity-0 group-hover:opacity-100 bg-black/5 dark:bg-white/10 pointer-events-auto"
                >
                     <div className="w-8 h-1 bg-gray-400 rounded-full mb-0.5" />
                </div>
            </div>
        )
    };

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            {/* BACKLOG PANEL */}
            <div 
                onDragOver={handleDragOver}
                onDrop={handleDropOnBacklog}
                className={`transition-all duration-300 flex flex-col border-r flex-shrink-0 ${isBacklogOpen ? 'w-64' : 'w-10'} ${isDark ? 'bg-[#121214] border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
            >
                {isBacklogOpen ? (
                    <>
                        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                <List size={14} /> Backlog
                            </h3>
                            <button onClick={() => setIsBacklogOpen(false)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}>
                                <PanelLeftClose size={16} />
                            </button>
                        </div>
                        <div className={`px-4 py-2 border-b text-[10px] ${isDark ? 'border-zinc-800 text-zinc-600' : 'border-gray-200 text-gray-400'}`}>
                            Arrastra tareas a una hora
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {projects.map(proj => {
                                const projTasks = tasks.filter(t => t.projectId === proj.id && !t.completed && !t.dueDate); 
                                const colorStyle = PROJECT_COLORS[proj.color || 'gray'];
                                return (
                                    <div key={proj.id} className="mb-4">
                                        <div 
                                            onClick={() => toggleProject(proj.id)}
                                            className={`flex items-center justify-between px-2 py-1 mb-1 rounded cursor-pointer group ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {expandedProjects[proj.id] ? <ChevronUp size={12} className={isDark ? 'text-zinc-500' : 'text-gray-400'} /> : <ChevronDown size={12} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />}
                                                <div className={`w-2 h-2 rounded-full ${colorStyle.dot}`} />
                                                <span className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{proj.name}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => toggleProjectVisibility(proj.id, e)}
                                                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-black hover:bg-gray-300'}`}
                                                title={visibleProjects[proj.id] ? "Ocultar en calendario" : "Mostrar en calendario"}
                                            >
                                                {visibleProjects[proj.id] ? <Eye size={12} /> : <EyeOff size={12} />}
                                            </button>
                                        </div>
                                        {expandedProjects[proj.id] && (
                                            <div className="pl-2 space-y-1">
                                                {projTasks.length === 0 && <div className={`text-[10px] pl-2 italic ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Vacío</div>}
                                                {projTasks.map(t => (
                                                    <BacklogTaskCard key={t.id} task={t} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center pt-4 gap-4">
                         <button onClick={() => setIsBacklogOpen(true)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}>
                            <PanelLeftOpen size={20} />
                        </button>
                        <div className={`writing-vertical-rl text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                            Proyectos
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CALENDAR CONTENT (Single Scroll Container for alignment) */}
            <div className={`flex-1 h-full overflow-y-auto custom-scrollbar relative ${isDark ? 'bg-[#09090b]' : 'bg-white'}`}>
                {/* Min-width wrapper to force horizontal scroll if needed, keeping columns aligned */}
                <div className="flex flex-col min-w-[700px]">
                    
                    {/* STICKY HEADER AREA */}
                    <div className={`sticky top-0 z-30 border-b shadow-sm ${isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                        {/* Header Controls */}
                        <div className="h-12 border-b flex items-center justify-between px-6 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                    {weekStartStr} - {weekEndStr}
                                </h2>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(d.getDate()-7); return n;})} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}><ChevronLeft size={18}/></button>
                                    <button onClick={() => setCurrentWeekStart(getMonday(new Date()))} className={`text-xs font-bold px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Hoy</button>
                                    <button onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(d.getDate()+7); return n;})} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}><ChevronRight size={18}/></button>
                                    <button onClick={() => setIsAllDayExpanded(!isAllDayExpanded)} className={`ml-2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} title={isAllDayExpanded ? "Colapsar todo el día" : "Expandir"}>
                                        {isAllDayExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Days Header Row */}
                        <div className="flex">
                            {/* Empty corner block (over time labels) */}
                            <div className={`w-14 flex-shrink-0 border-r ${isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-gray-100 bg-white'}`} />
                            
                            {/* Day Columns */}
                            <div className="flex-1 grid grid-cols-5 divide-x">
                                {weekDays.map((day, i) => {
                                    const dateStr = day.toISOString().split('T')[0];
                                    const isToday = isDueToday(dateStr);
                                    const dayTasks = visibleTasks.filter(t => t.dueDate === dateStr && !t.completed);
                                    const untimedTasks = dayTasks.filter(t => !t.dueTime);
                                    return (
                                        <div 
                                            key={i} 
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDropOnAllDay(e, day)}
                                            className={`flex flex-col relative ${isDark ? 'divide-zinc-800 border-zinc-800' : 'divide-gray-100 border-gray-100'} ${isToday ? isDark ? 'bg-zinc-900/20' : 'bg-emerald-50/20' : ''}`}
                                        >
                                            <div className={`p-2 text-center border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                                                <span className={`text-[10px] font-bold uppercase block mb-1 ${isToday ? 'text-emerald-500' : isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                                    {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                                                </span>
                                                <div className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                                    {day.getDate()}
                                                </div>
                                            </div>
                                            {/* Untimed Tasks Area */}
                                            {isAllDayExpanded && (
                                                <div className={`p-1 min-h-[40px] space-y-1 border-b transition-colors ${isDark ? 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                                                    {untimedTasks.map(t => {
                                                        const project = projects.find(p => p.id === t.projectId);
                                                        const colorStyle = PROJECT_COLORS[project?.color || 'gray'];
                                                        return (
                                                            <div 
                                                                key={t.id} 
                                                                draggable
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onDragStart={(e) => handleDragStart(e, t.id)}
                                                                onClick={(e) => { e.stopPropagation(); onEditTask(t); }}
                                                                className={`p-1 rounded border text-[10px] cursor-move select-none truncate ${colorStyle.bg} ${colorStyle.border} ${colorStyle.text}`}
                                                            >
                                                                {t.title}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                            {!isAllDayExpanded && untimedTasks.length > 0 && (
                                                <div className={`h-2 border-b flex justify-center items-center ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'}`} title={`${untimedTasks.length} tareas sin hora`}>
                                                    <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-gray-400'}`} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* TIME GRID BODY */}
                    <div className="flex relative">
                        {/* Time Labels (Gutter) */}
                        <div className={`w-14 flex-shrink-0 border-r pt-2 ${isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-gray-100 bg-white'}`}>
                            {hours.map(h => (
                                <div key={h} style={{ height: `${PIXELS_PER_HOUR}px` }} className="relative">
                                    <span className={`absolute -top-2.5 right-2 text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                        {h.toString().padStart(2, '0')}:00
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Grid Columns */}
                        <div className="flex-1 grid grid-cols-5 divide-x min-w-0">
                             {weekDays.map((day, i) => {
                                 const dateStr = day.toISOString().split('T')[0];
                                 const dayTasks = visibleTasks.filter(t => t.dueDate === dateStr && !t.completed);
                                 const timedTasks = dayTasks.filter(t => t.dueTime);
                                 const isToday = isDueToday(dateStr);

                                 return (
                                     <div key={i} className={`flex flex-col relative ${isDark ? 'divide-zinc-800 border-zinc-800' : 'divide-gray-100 border-gray-100'} ${isToday ? isDark ? 'bg-zinc-900/10' : 'bg-emerald-50/10' : ''}`}>
                                          <div 
                                            className="relative w-full" 
                                            style={{ height: `${24 * PIXELS_PER_HOUR}px` }}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDropOnDayGrid(e, day)}
                                          >
                                              {hours.map(h => (
                                                  <div key={h} className={`absolute w-full border-t pointer-events-none ${isDark ? 'border-zinc-800/50' : 'border-gray-100'}`} style={{ top: h * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}>
                                                      <div className={`absolute w-full border-t border-dashed pointer-events-none ${isDark ? 'border-zinc-900' : 'border-gray-50'}`} style={{ top: '50%' }} />
                                                  </div>
                                              ))}
                                              {timedTasks.map(t => (
                                                  <TimeGridTask key={t.id} task={t} />
                                              ))}
                                          </div>
                                     </div>
                                 )
                             })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};