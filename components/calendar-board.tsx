import React, { useState, useEffect, useMemo, memo } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, List, ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { Task, Project } from '../types';
import { PRIORITIES, getMonday, isDueToday, getEndTime, PROJECT_COLORS, parseLocalDate } from '../utils';

// Helper to calculate minutes for layout logic
const getMinutes = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// Algorithm to calculate overlapping positions
const calculateDayLayouts = (dayTasks: Task[]) => {
    // 1. Sort tasks by start time
    const sorted = [...dayTasks].sort((a, b) => getMinutes(a.dueTime!) - getMinutes(b.dueTime!));
    const layouts: Record<string, { left: number, width: number }> = {};
    
    // 2. Group into overlapping clusters
    const clusters: Task[][] = [];
    let currentCluster: Task[] = [];
    let clusterEnd = -1;

    sorted.forEach(task => {
        const start = getMinutes(task.dueTime!);
        const end = start + (task.duration || 60);

        if (currentCluster.length === 0) {
            currentCluster.push(task);
            clusterEnd = end;
        } else {
            // Check intersection with the cluster bounds
            if (start < clusterEnd) {
                currentCluster.push(task);
                clusterEnd = Math.max(clusterEnd, end);
            } else {
                clusters.push(currentCluster);
                currentCluster = [task];
                clusterEnd = end;
            }
        }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // 3. Process clusters to assign columns
    clusters.forEach(cluster => {
        const columns: Task[][] = [];
        cluster.forEach(task => {
            const start = getMinutes(task.dueTime!);
            let placed = false;
            // Try to fit in existing column
            for(const col of columns) {
                const lastTask = col[col.length - 1];
                const lastEnd = getMinutes(lastTask.dueTime!) + (lastTask.duration || 60);
                if (start >= lastEnd) {
                    col.push(task);
                    placed = true;
                    break;
                }
            }
            if (!placed) columns.push([task]);
        });

        const width = 100 / columns.length;
        columns.forEach((col, colIndex) => {
            col.forEach(task => {
                layouts[task.id] = {
                    left: colIndex * width,
                    width: width
                };
            });
        });
    });

    return layouts;
};

const PIXELS_PER_HOUR = 60;
const PIXELS_PER_15_MIN = PIXELS_PER_HOUR / 4;

// --- Subcomponents extracted to prevent re-renders ---

const BacklogTaskCard = memo(({ task, projects, isDark, onDragStart, onEditTask }: any) => {
    const project = projects.find((p: any) => p.id === task.projectId);
    const colorStyle = PROJECT_COLORS[project?.color || 'gray'];

    return (
        <div 
            draggable 
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => onDragStart(e, task.id)}
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
});

const AllDayTaskCard = memo(({ task, projects, isDark, onDragStart, onEditTask }: any) => {
    const project = projects.find((p: any) => p.id === task.projectId);
    const colorStyle = PROJECT_COLORS[project?.color || 'gray'];
    const isVirtual = task.id.includes('_virtual_');

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVirtual) {
            const realId = task.id.split('_virtual_')[0];
            onEditTask({ ...task, id: realId });
        } else {
            onEditTask(task);
        }
    };

    return (
        <div 
            draggable={!isVirtual}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => !isVirtual && onDragStart(e, task.id)}
            onClick={handleEdit}
            className={`p-1.5 mb-1 rounded border text-[10px] cursor-move hover:shadow-sm transition-all select-none ${colorStyle.bg} ${colorStyle.border} ${isVirtual ? 'border-dashed' : ''} ${task.completed ? 'opacity-60' : ''}`}
        >
            <div className={`font-bold truncate leading-tight flex items-center gap-1 ${colorStyle.text}`}>
                {task.title}
                {isVirtual && <Repeat size={8} className="opacity-70" />}
            </div>
        </div>
    );
});

const TimeGridTask = memo(({ task, layout, projects, isDark, resizingTask, draggingTaskId, onEditTask, onDragStart, onResizeStart }: any) => {
    let top = 0;
    if (task.dueTime) {
        const [h, m] = task.dueTime.split(':').map(Number);
        top = (h * 60 + m) * (PIXELS_PER_HOUR / 60);
    }
    let height = (task.duration || 60) * (PIXELS_PER_HOUR / 60);
    
    const project = projects.find((p: any) => p.id === task.projectId);
    const colorStyle = PROJECT_COLORS[project?.color || 'gray'];
    const isDragging = draggingTaskId === task.id;
    const isVirtual = task.id.includes('_virtual_');

    // Determine Layout Style
    const layoutStyle: React.CSSProperties = {
        top: `${top}px`,
        height: `${height}px`,
        left: layout ? `${layout.left}%` : '2px',
        width: layout ? `calc(${layout.width}% - 2px)` : 'calc(100% - 4px)',
        zIndex: resizingTask === task.id ? 50 : (isDragging ? 40 : 10),
        opacity: isDragging ? 0.5 : (task.completed ? 0.6 : isVirtual ? 0.7 : 1)
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isVirtual) {
            const realId = task.id.split('_virtual_')[0];
            onEditTask({ ...task, id: realId });
        } else {
            onEditTask(task);
        }
    };

    return (
        <div
            draggable={!isVirtual && resizingTask !== task.id}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => !isVirtual && onDragStart(e, task.id)}
            onClick={handleEdit}
            style={layoutStyle}
            className={`absolute rounded border text-[10px] select-none group overflow-hidden flex flex-col ${colorStyle.bg} ${isVirtual ? 'border-dashed' : ''} ${colorStyle.border} ${resizingTask ? 'pointer-events-none' : ''}`}
        >
            <div className="pl-2 pr-1 py-1 flex-1 min-h-0">
                <div className={`font-bold truncate leading-tight flex items-center gap-1 ${colorStyle.text}`}>
                    {task.title}
                    {isVirtual && <Repeat size={8} className="opacity-70" />}
                </div>
                {height > 30 && <div className={`truncate opacity-70 ${colorStyle.text}`}>{task.dueTime} - {getEndTime(task.dueTime || '00:00', task.duration || 60)}</div>}
            </div>
            {!isVirtual && (
                <div 
                    onMouseDown={(e) => onResizeStart(e, task.id, task.duration || 60)}
                    className="h-2 w-full cursor-s-resize absolute bottom-0 left-0 flex justify-center items-end opacity-0 group-hover:opacity-100 bg-black/5 dark:bg-white/10 pointer-events-auto"
                >
                     <div className="w-8 h-1 bg-gray-400 rounded-full mb-0.5" />
                </div>
            )}
        </div>
    )
});

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
    const [now, setNow] = useState(new Date());
    
    // Interaction States
    const [resizingTask, setResizingTask] = useState<string | null>(null);
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    
    // Resize Refs
    const [resizeStartY, setResizeStartY] = useState<number>(0);
    const [resizeStartHeight, setResizeStartHeight] = useState<number>(0);
    const [tempHeight, setTempHeight] = useState<number | null>(null);

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

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

    const visibleTasks = useMemo(() => tasks.filter(t => visibleProjects[t.projectId]), [tasks, visibleProjects]);

    // Generate Virtual Tasks for Recurrence
    const allWeekTasks = useMemo(() => {
        const virtualTasks: Task[] = [];
        // Only process recurrence if we have days
        if (weekDays.length === 0) return visibleTasks;

        visibleTasks.forEach(task => {
            // Must have recurrence, a due date, and not be completed (unless we want to show completed recurrences, but usually next one is separate)
            if (!task.recurrence || task.recurrence === 'none' || !task.dueDate || task.completed) return;

            const taskDate = parseLocalDate(task.dueDate);
            if (!taskDate) return;

            weekDays.forEach(day => {
                const dayStr = day.toISOString().split('T')[0];
                
                // If this is the ACTUAL due date, the real task is already in visibleTasks, so skip
                if (dayStr === task.dueDate) return;

                // If day is before the start date of the recurrence, skip
                if (day < taskDate) return;

                let matches = false;
                
                if (task.recurrence === 'daily') {
                    matches = true;
                } else if (task.recurrence === 'weekly') {
                    if (day.getDay() === taskDate.getDay()) matches = true;
                } else if (task.recurrence === 'monthly') {
                    if (day.getDate() === taskDate.getDate()) matches = true;
                } else if (task.recurrence === 'yearly') {
                    if (day.getDate() === taskDate.getDate() && day.getMonth() === taskDate.getMonth()) matches = true;
                }

                if (matches) {
                    virtualTasks.push({
                        ...task,
                        id: `${task.id}_virtual_${dayStr}`, // Unique ID for React Key
                        dueDate: dayStr,
                        completed: false // Projections are always Todo
                    });
                }
            });
        });

        return [...visibleTasks, ...virtualTasks];
    }, [visibleTasks, weekDays]);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.stopPropagation(); // Prevent bubbling to container
        setDraggingTaskId(taskId);
        
        // Calculate the offset from the top of the card
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const grabOffsetY = e.clientY - rect.top;

        e.dataTransfer.setData("taskId", taskId);
        e.dataTransfer.setData("grabOffsetY", grabOffsetY.toString());
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        setDraggingTaskId(null);
    };

    const handleDropOnBacklog = (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if(taskId) {
            onUpdateTask(taskId, null); 
            setDraggingTaskId(null);
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
             setDraggingTaskId(null);
        }
    };

    const handleDropOnDayGrid = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        // Get the offset stored during dragStart
        const grabOffsetStr = e.dataTransfer.getData("grabOffsetY");
        const grabOffsetY = grabOffsetStr ? parseFloat(grabOffsetStr) : 0;

        if(taskId) {
            const rect = e.currentTarget.getBoundingClientRect();
            // Mouse position relative to the grid
            const mouseInGridY = e.clientY - rect.top;
            
            // Calculate where the TOP of the card is
            // (Mouse Position) - (Distance from mouse to top of card)
            const taskTopY = mouseInGridY - grabOffsetY;
            
            // Prevent dropping 'above' the day (negative time)
            const safeY = Math.max(0, taskTopY);
            
            const totalMinutes = (safeY / PIXELS_PER_HOUR) * 60;
            const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
            
            const hours = Math.floor(snappedMinutes / 60);
            const minutes = snappedMinutes % 60;
            const clampedHours = Math.max(0, Math.min(23, hours));
            const timeStr = `${clampedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            const dateStr = date.toISOString().split('T')[0];

            const task = tasks.find(t => t.id === taskId);
            const duration = task?.duration || 60;

            onUpdateTaskTime(taskId, dateStr, timeStr, duration);
            setDraggingTaskId(null);
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
    }, [resizingTask, resizeStartY, resizeStartHeight, tempHeight, tasks]);

    const weekStartStr = currentWeekStart.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    const weekEnd = new Date(currentWeekStart); weekEnd.setDate(weekEnd.getDate()+4);
    const weekEndStr = weekEnd.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

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
                                                    <BacklogTaskCard 
                                                        key={t.id} 
                                                        task={t} 
                                                        projects={projects}
                                                        isDark={isDark}
                                                        onDragStart={handleDragStart}
                                                        onEditTask={onEditTask}
                                                    />
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
            <div 
                className={`flex-1 h-full overflow-y-auto custom-scrollbar relative ${isDark ? 'bg-[#09090b]' : 'bg-white'}`}
                onDragEnd={handleDragEnd} // Global drag end handler
            >
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
                                    // Use allWeekTasks to include virtual tasks in All-Day view (if they have no time)
                                    // But typically recurring tasks have times. If not, they end up here.
                                    const dayTasks = allWeekTasks.filter(t => t.dueDate === dateStr && !t.completed);
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
                                                    {untimedTasks.map(t => (
                                                        <AllDayTaskCard 
                                                            key={t.id} 
                                                            task={t} 
                                                            projects={projects}
                                                            isDark={isDark}
                                                            onDragStart={handleDragStart}
                                                            onEditTask={onEditTask}
                                                        />
                                                    ))}
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
                                 // Use allWeekTasks to include virtual tasks
                                 const dayTasks = allWeekTasks.filter(t => t.dueDate === dateStr && !t.completed);
                                 const timedTasks = dayTasks.filter(t => t.dueTime);
                                 const isToday = isDueToday(dateStr);
                                 
                                 // Calculate layout for this specific day
                                 const layouts = calculateDayLayouts(timedTasks);
                                 
                                 // Current Time Line Position
                                 const currentHour = now.getHours();
                                 const currentMinute = now.getMinutes();
                                 const currentTimeTop = (currentHour * 60 + currentMinute) * (PIXELS_PER_HOUR / 60);

                                 return (
                                     <div key={i} className={`flex flex-col relative ${isDark ? 'divide-zinc-800 border-zinc-800' : 'divide-gray-100 border-gray-100'} ${isToday ? isDark ? 'bg-zinc-900/10' : 'bg-emerald-50/10' : ''}`}>
                                          <div 
                                            className="relative w-full" 
                                            style={{ height: `${24 * PIXELS_PER_HOUR}px` }}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDropOnDayGrid(e, day)}
                                          >
                                              {/* Current Time Indicator */}
                                              {isToday && (
                                                <div 
                                                    className="absolute w-full flex items-center z-20 pointer-events-none"
                                                    style={{ top: `${currentTimeTop}px` }}
                                                >
                                                    <div className={`absolute -left-1.5 w-3 h-3 rounded-full bg-[#10B981] border-2 ${isDark ? 'border-[#09090b]' : 'border-white'}`} />
                                                    <div className="w-full h-[2px] bg-[#10B981]" />
                                                </div>
                                              )}

                                              {hours.map(h => (
                                                  <div key={h} className={`absolute w-full border-t pointer-events-none ${isDark ? 'border-zinc-800/50' : 'border-gray-100'}`} style={{ top: h * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}>
                                                      <div className={`absolute w-full border-t border-dashed pointer-events-none ${isDark ? 'border-zinc-900' : 'border-gray-50'}`} style={{ top: '50%' }} />
                                                  </div>
                                              ))}
                                              {timedTasks.map(t => {
                                                  // NOTE: If resizing, override height locally for visual smoothness, 
                                                  // but for drag optimization we just pass props.
                                                  let effectiveTask = t;
                                                  if (resizingTask === t.id && tempHeight !== null) {
                                                      effectiveTask = { ...t, duration: Math.round((tempHeight / PIXELS_PER_HOUR) * 60) };
                                                  }
                                                  
                                                  return (
                                                    <TimeGridTask 
                                                        key={t.id} 
                                                        task={effectiveTask} 
                                                        layout={layouts[t.id]}
                                                        projects={projects}
                                                        isDark={isDark}
                                                        resizingTask={resizingTask}
                                                        draggingTaskId={draggingTaskId}
                                                        onEditTask={onEditTask}
                                                        onDragStart={handleDragStart}
                                                        onResizeStart={handleResizeStart}
                                                    />
                                                  );
                                              })}
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