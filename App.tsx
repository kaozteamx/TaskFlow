import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Layout, Plus, Circle, Trash2, FolderOpen, X, Edit2, CheckCircle2, 
  Flag, ExternalLink, CloudCog, Download, Upload, Loader2, Calendar as CalendarIcon, 
  List, PanelLeftClose, PanelLeftOpen, BarChart3, Search, FilterX, StickyNote, Repeat, 
  ClipboardList, SidebarClose, SidebarOpen, Sun, Moon, FileSpreadsheet, Home,
  ChevronDown, ChevronRight, Clock
} from 'lucide-react';

// --- Imports from Refactored Modules ---
import { auth, db, signInAnonymously, onAuthStateChanged, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch, getDocs, IS_DEMO, __app_id } from './firebase-setup';
import { Project, Task, NotificationType } from './types';
import { 
  HOME_VIEW, PRIORITIES, RECURRENCE_OPTIONS, TIME_SLOTS, 
  safeDate, parseLocalDate, formatDate, formatCreationDate, getDaysOpen, isOverdue, 
  isDueToday, calculateNextDueDate, getEndTime, calculateDuration 
} from './utils';

// --- Component Imports ---
import { CustomTimeSelect, NotificationToast, MiniCalendar, PerformanceChart } from './components/ui-elements';
import { ConfirmationModal, CloudSyncModal, PomodoroLogModal, ProjectModal } from './components/modals';
import { TaskNoteModal } from './components/task-note-modal';
import { PomodoroTimer } from './components/pomodoro-timer';
import { CalendarBoard } from './components/calendar-board';
import { TaskItem } from './components/task-item';

const App = () => {
  const [authUser, setAuthUser] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [customUid, setCustomUid] = useState<string | null>(() => localStorage.getItem('taskflow_custom_uid'));
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState<Project>(HOME_VIEW);
  const [isDark, setIsDark] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [checklistModalTask, setChecklistModalTask] = useState<Task | null>(null);
  
  // Project Management States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectLinks, setProjectLinks] = useState<{name:string, url:string}[]>([{name:'', url:''}]);

  // List View States
  const [projectNotes, setProjectNotes] = useState('');
  const prevProjectIdRef = useRef<string|null>(null);
  const [sortBy, setSortBy] = useState('priority');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  
  // States required for full functionality
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>({ isOpen: false });
  const [pomodoroLogModalOpen, setPomodoroLogModalOpen] = useState(false);
  const [completedFocusMinutes, setCompletedFocusMinutes] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importPendingDataRef = useRef<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync authUser to user
  useEffect(() => { setUser(authUser); }, [authUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: any) => {
      setAuthUser(u);
      if (!u) {
        signInAnonymously(auth).catch((e: any) => console.error(e));
      }
    });
    return unsubscribe;
  }, []);

  const userId = useMemo(() => customUid || authUser?.uid, [customUid, authUser]);

  const getCollectionRef = (collectionName: string) => {
      if (customUid) {
          return collection(db, 'artifacts', __app_id, 'public', 'data', `${collectionName}_${customUid}`);
      }
      if (!authUser?.uid) return collection(db, collectionName); 
      return collection(db, 'artifacts', __app_id, 'users', authUser.uid, collectionName);
  };

  useEffect(() => {
    if (!userId && !IS_DEMO) return;
    
    const targetProjectsRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
    const targetTasksRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');

    const unsubProjects = onSnapshot(query(targetProjectsRef), (snap: any) => {
        const list = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        setProjects([HOME_VIEW, ...list]);
        if (activeProject && activeProject.id !== HOME_VIEW.id) {
           const updated = list.find((p: any) => p.id === activeProject.id);
           if (updated) setActiveProject(updated);
           else setActiveProject(HOME_VIEW);
        }
    });

    const unsubTasks = onSnapshot(query(targetTasksRef), (snap: any) => {
        const list = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        setTasks(list);
        setLoading(false);
    });

    return () => {
        unsubProjects();
        unsubTasks();
    };
  }, [userId, activeProject?.id]);

  // Sync Project Notes
  useEffect(() => {
      if (activeProject && activeProject.id !== HOME_VIEW.id) {
          if (prevProjectIdRef.current !== activeProject.id) {
              setProjectNotes(activeProject.quickNotes || '');
              prevProjectIdRef.current = activeProject.id;
          }
      }
      // Reset filters when changing project
      setSelectedDateFilter(null);
      setSearchQuery('');
  }, [activeProject]);

  // Handle click outside details panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (editingTask && detailsPanelRef.current && !detailsPanelRef.current.contains(event.target as Node)) {
            setEditingTask(null);
        }
    };
    
    // Using mousedown for faster response than click, and to match typical "dismiss" behavior
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingTask]);

  const handleSaveNotes = async () => {
      if (!activeProject || activeProject.id === HOME_VIEW.id || (!userId && !customUid)) return;
      if (projectNotes === (activeProject.quickNotes || '')) return;
      const colRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
      try { await updateDoc(doc(colRef, activeProject.id), { quickNotes: projectNotes }); } 
      catch (error) { console.error("Error saving notes:", error); }
  };

  const handleUpdateNote = async (taskId: string, newNoteContent: string) => {
      const colRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await updateDoc(doc(colRef, taskId), { noteContent: newNoteContent });
      
      // Update local editing state if necessary to ensure immediate UI reflection
      if (editingTask && editingTask.id === taskId) {
          setEditingTask((prev) => prev ? { ...prev, noteContent: newNoteContent } : null);
      }
  };

  const handleUpdateTask = async (id: string, date: string | null) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      // If date is null (dragged to backlog), clear dueTime as well
      const updates: any = { dueDate: date };
      if (!date) {
          updates.dueTime = '';
          updates.duration = 60; // reset to default
      }
      await updateDoc(doc(ref, id), updates);
      setNotification({ type: 'success', message: 'Tarea actualizada' });
  };

  const handleUpdateTaskTime = async (id: string, date: string, time: string, duration: number) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await updateDoc(doc(ref, id), { dueDate: date, dueTime: time, duration });
      setNotification({ type: 'success', message: 'Horario actualizado' });
  };

  const handleUpdateTaskDetail = async (field: keyof Task, value: any) => { 
      if (!editingTask) return; 
      setEditingTask(p => p ? ({ ...p, [field]: value }) : null); 
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await updateDoc(doc(ref, editingTask.id), { [field]: value }); 
  };

  const handleToggleTask = async (task: Task) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      const isCompleting = !task.completed;

      await updateDoc(doc(ref, task.id), { 
          completed: isCompleting,
          completedAt: isCompleting ? serverTimestamp() : null
      });

      // Ensure recurrence check is robust (defaults to 'none' if undefined)
      const recurrenceType = task.recurrence || 'none';
      if (isCompleting && recurrenceType !== 'none') {
          const nextDate = calculateNextDueDate(task.dueDate, recurrenceType);
          if (nextDate) {
              await addDoc(ref, { 
                  projectId: task.projectId, 
                  title: task.title, 
                  description: task.description || '',
                  dueDate: nextDate,
                  dueTime: task.dueTime || '',
                  duration: task.duration || 60,
                  completed: false, 
                  parentTaskId: task.parentTaskId || null,
                  priority: task.priority || 'medium',
                  recurrence: recurrenceType,
                  noteContent: task.noteContent || '',
                  createdAt: serverTimestamp()
              });
              setNotification({ type: 'success', message: '¡Completada! Siguiente repetición creada.' });
          }
      }
  };

  const handleDeleteTask = async (id: string) => {
      const taskToDelete = tasks.find(t => t.id === id);
      setConfirmModal({
          isOpen: true,
          title: 'Eliminar Tarea',
          message: `¿Estás seguro que deseas eliminar "${taskToDelete?.title || 'la tarea'}"?`,
          confirmText: "Eliminar",
          onConfirm: async () => {
              const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
              await deleteDoc(doc(ref, id));
              if (editingTask?.id === id) setEditingTask(null);
              setNotification({ type: 'success', message: 'Tarea eliminada' });
              setConfirmModal({ isOpen: false });
          }
      });
  };
  
  const handleQuickAddTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickTaskTitle.trim()) return;
      let targetProjectId = activeProject.id;
      if (targetProjectId === HOME_VIEW.id) { 
          if (projects.length > 1) targetProjectId = projects[1].id; 
          else { setNotification({type:'error', message:'Crea un proyecto primero'}); return; }
      }
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await addDoc(ref, { 
          projectId: targetProjectId, 
          title: quickTaskTitle, 
          completed: false, 
          createdAt: serverTimestamp(),
          priority: 'medium',
          dueDate: selectedDateFilter || '',
          noteContent: '',
          recurrence: 'none' // Initialize recurrence field
      });
      setQuickTaskTitle('');
  };

  const handleAddSubtask = async (e: any) => { 
      e.preventDefault(); 
      if (!editingTask) return;
      const title = e.target.subtaskTitle.value; 
      if (!title.trim()) return; 
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await addDoc(ref, { 
          projectId: editingTask.projectId, 
          parentTaskId: editingTask.id, 
          title: title, 
          completed: false, 
          createdAt: serverTimestamp(),
          recurrence: 'none'
      }); 
      e.target.reset(); 
  };

  // --- Project Handlers ---
  const openProjectModal = (proj: Project | null) => {
      if (proj) {
          setEditingProject(proj);
          setProjectName(proj.name);
          setProjectLinks(proj.links || (proj.link ? [{name:'Recurso', url:proj.link}] : [{name:'', url:''}]));
      } else {
          setEditingProject(null);
          setProjectName('');
          setProjectLinks([{name:'', url:''}]);
      }
      setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (e: any) => {
      e.preventDefault();
      if (!projectName.trim() || (!userId && !IS_DEMO)) return;
      
      const validLinks = projectLinks.filter(l => l.url.trim() !== '');
      const colRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
      
      try {
          if (editingProject) {
              await updateDoc(doc(colRef, editingProject.id), { name: projectName, links: validLinks });
              setNotification({ type: 'success', message: 'Proyecto actualizado' });
          } else {
              await addDoc(colRef, { name: projectName, links: validLinks, createdAt: serverTimestamp(), quickNotes: '' });
              setNotification({ type: 'success', message: 'Proyecto creado' });
          }
          setIsProjectModalOpen(false);
      } catch (err: any) {
          setNotification({ type: 'error', message: 'Error al guardar proyecto' });
      }
  };

  const handleDeleteProject = (proj: Project) => {
      setConfirmModal({
          isOpen: true,
          title: 'Eliminar Proyecto',
          message: `Se eliminará "${proj.name}" y todas sus tareas asociadas. ¿Estás seguro?`,
          onConfirm: async () => {
               const pRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
               const tRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
               
               // Delete Project
               await deleteDoc(doc(pRef, proj.id));
               
               // Delete Tasks
               const projTasks = tasks.filter(t => t.projectId === proj.id);
               for (const t of projTasks) {
                   await deleteDoc(doc(tRef, t.id));
               }
               
               if (activeProject.id === proj.id) setActiveProject(HOME_VIEW);
               setConfirmModal({ isOpen: false });
               setNotification({ type: 'success', message: 'Proyecto eliminado' });
          }
      });
  };

  // --- Cloud & Backup Handlers ---
  const handleSetCustomId = (id: string) => { 
      setCustomUid(id); 
      localStorage.setItem('taskflow_custom_uid', id); 
      setIsCloudSyncModalOpen(false); 
      setNotification({ type: 'success', message: 'Conectado a espacio compartido.' }); 
      setActiveProject(HOME_VIEW); 
  };
  
  const handleClearCustomId = () => { 
      setCustomUid(null); 
      localStorage.removeItem('taskflow_custom_uid'); 
      setIsCloudSyncModalOpen(false); 
      setNotification({ type: 'info', message: 'Desconectado. Regresando a espacio privado.' }); 
      setActiveProject(HOME_VIEW); 
  };

  const handleActivateCloudMode = async () => {
      if (!authUser?.uid) return;
      try {
          const projectsSnap = await getDocs(getCollectionRef('projects'));
          const tasksSnap = await getDocs(getCollectionRef('tasks'));
          const targetSuffix = authUser.uid;
          
          const chunks = []; let currentBatch = writeBatch(db); let count = 0;
          const pushBatch = () => { chunks.push(currentBatch); currentBatch = writeBatch(db); count = 0; };
          
          projectsSnap.forEach((docSnap: any) => { 
              const data = docSnap.data(); 
              const newRef = doc(db, 'artifacts', __app_id, 'public', 'data', `projects_${targetSuffix}`, docSnap.id); 
              currentBatch.set(newRef, data); 
              count++; if (count >= 450) pushBatch(); 
          });
          tasksSnap.forEach((docSnap: any) => { 
              const data = docSnap.data(); 
              const newRef = doc(db, 'artifacts', __app_id, 'public', 'data', `tasks_${targetSuffix}`, docSnap.id); 
              currentBatch.set(newRef, data); 
              count++; if (count >= 450) pushBatch(); 
          });
          
          if (count > 0) chunks.push(currentBatch);
          await Promise.all(chunks.map((b: any) => b.commit()));
          handleSetCustomId(authUser.uid);
          setNotification({ type: 'success', message: 'Modo Nube Activado.' });
      } catch (error: any) { 
          setNotification({ type: 'error', message: 'Error: ' + error.message }); 
      }
  };

  const handleExportData = async () => {
      setIsBackingUp(true);
      try {
        const projectsSnap = await getDocs(getCollectionRef('projects'));
        const tasksSnap = await getDocs(getCollectionRef('tasks'));
        const logsSnap = await getDocs(getCollectionRef('pomodoro_logs'));
        const exportData = { 
            projects: projectsSnap.docs.map((d: any) => ({id: d.id, ...d.data()})), 
            tasks: tasksSnap.docs.map((d: any) => ({id: d.id, ...d.data()})), 
            pomodoro_logs: logsSnap.docs.map((d: any) => ({id: d.id, ...d.data()})), 
            exportDate: new Date().toISOString(), version: 1 
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; const d = new Date(); const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; a.download = `taskflow_backup_${dateStr}.json`; a.click(); 
        setNotification({ type: 'success', message: 'Backup guardado localmente' });
      } catch (e) { setNotification({ type: 'error', message: 'Error al crear backup' }); } finally { setIsBackingUp(false); }
  };

  const handleExportPomodoroCSV = async () => {
      setIsExportingCSV(true);
      try {
          const logsSnap = await getDocs(getCollectionRef('pomodoro_logs'));
          if (logsSnap.empty) {
              setNotification({ type: 'warning', message: 'No hay registros.' });
              setIsExportingCSV(false);
              return;
          }
          
          const logs = logsSnap.docs.map((d: any) => {
               const data = d.data();
               const dateObj = safeDate(data.createdAt);
               // Helper to get project name
               const proj = projects.find(p => p.id === data.projectId);
               return {
                   fecha: dateObj ? dateObj.toLocaleDateString('es-ES') : 'N/A',
                   hora: dateObj ? dateObj.toLocaleTimeString('es-ES') : 'N/A',
                   proyecto: `"${(proj ? proj.name : 'Desconocido').replace(/"/g, '""')}"`,
                   minutos: data.durationMinutes
               };
          });
  
          const headers = ['Fecha', 'Hora', 'Proyecto', 'Minutos'];
          const csvRows = logs.map((row: any) => `${row.fecha},${row.hora},${row.proyecto},${row.minutos}`);
          const csvContent = [headers.join(','), ...csvRows].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `pomodoro_report_${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setNotification({ type: 'success', message: 'CSV Generado' });
      } catch (e) {
          setNotification({ type: 'error', message: 'Error al exportar CSV' });
      } finally {
          setIsExportingCSV(false);
      }
  };

  const handleFileSelect = (e: any) => {
      const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
      reader.onload = (event: any) => {
          try { const data = JSON.parse(event.target.result); if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) { setNotification({ type: 'error', message: 'Formato inválido' }); return; } importPendingDataRef.current = data; setConfirmModal({ isOpen: true, title: 'Restaurar Backup', message: `Se cargarán ${data.projects.length} proyectos y ${data.tasks.length} tareas. ¿Continuar?`, confirmText: 'Restaurar', onConfirm: executeImport }); } catch (err) { setNotification({ type: 'error', message: 'Error al leer archivo' }); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
      }; reader.readAsText(file);
  };

  const executeImport = async () => {
      const data = importPendingDataRef.current; if (!data) return; setConfirmModal({ isOpen: false }); setIsImporting(true);
      try {
          const chunks = []; let currentBatch = writeBatch(db); let count = 0; const pushBatch = () => { chunks.push(currentBatch); currentBatch = writeBatch(db); count = 0; };
          const projCol = getCollectionRef('projects'); const taskCol = getCollectionRef('tasks'); const logCol = getCollectionRef('pomodoro_logs');
          for (const p of data.projects) { if (!p.id) continue; const ref = doc(projCol, p.id); const created = safeDate(p.createdAt) || new Date(); currentBatch.set(ref, { name: p.name || 'Sin nombre', createdAt: created, quickNotes: p.quickNotes || '', links: p.links || [] }); count++; if (count >= 450) pushBatch(); }
          for (const t of data.tasks) { 
              if (!t.id || !t.projectId) continue; 
              const ref = doc(taskCol, t.id); 
              const created = safeDate(t.createdAt) || new Date(); 
              currentBatch.set(ref, { 
                  projectId: t.projectId, 
                  title: t.title, 
                  completed: !!t.completed, 
                  createdAt: created, 
                  dueDate: t.dueDate || '', 
                  dueTime: t.dueTime || '', 
                  duration: t.duration || 60, 
                  noteContent: t.noteContent || '', 
                  description: t.description || '',
                  priority: t.priority || 'medium',
                  recurrence: t.recurrence || 'none'
              }); 
              count++; if (count >= 450) pushBatch(); 
          }
          if (data.pomodoro_logs && Array.isArray(data.pomodoro_logs)) { for (const l of data.pomodoro_logs) { const logId = l.id || doc(logCol).id; const ref = doc(logCol, logId); currentBatch.set(ref, { projectId: l.projectId, durationMinutes: l.durationMinutes, createdAt: safeDate(l.createdAt) || new Date() }); count++; if (count >= 450) pushBatch(); } }
          if (count > 0) chunks.push(currentBatch); await Promise.all(chunks.map((b: any) => b.commit())); 
          setNotification({ type: 'success', message: 'Restauración completa' }); 
      } catch (err: any) { setNotification({ type: 'error', message: `Error: ${err.message}` }); } finally { setIsImporting(false); }
  };

  const handleFocusComplete = useCallback((minutes: number) => { setCompletedFocusMinutes(minutes); setPomodoroLogModalOpen(true); }, []);
  const handleLogPomodoro = async (projectId: string) => { 
      if (!projectId) return; 
      try { 
          await addDoc(getCollectionRef('pomodoro_logs'), { projectId, durationMinutes: completedFocusMinutes, createdAt: serverTimestamp() }); 
          setPomodoroLogModalOpen(false); 
          setNotification({ type: 'success', message: 'Sesión registrada' }); 
      } catch (error) { console.error(error); } 
  };
  
  const activeRootTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.parentTaskId);
    
    if (activeProject.id !== HOME_VIEW.id) {
        filtered = filtered.filter(t => t.projectId === activeProject.id);
    }
    
    if (selectedDateFilter) {
        filtered = filtered.filter(t => t.dueDate === selectedDateFilter);
    }

    if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(t => t.title.toLowerCase().includes(lowerQuery));
    }

    return filtered.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        
        if (sortBy === 'priority') {
            const priorityScore: any = { high: 3, medium: 2, low: 1, none: 0 };
            const scoreA = priorityScore[a.priority || 'none'] || 0;
            const scoreB = priorityScore[b.priority || 'none'] || 0;
            if (scoreA !== scoreB) return scoreB - scoreA;
            
            // Secondary sort: Overdue/Date Ascending
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
            return dateA - dateB;

        } else if (sortBy === 'date') {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
            return dateA - dateB; 
        } else if (sortBy === 'created') {
             // Oldest First (Ascending)
             return (safeDate(a.createdAt)?.getTime() || 0) - (safeDate(b.createdAt)?.getTime() || 0);
        }
        return 0;
    });
  }, [tasks, activeProject, sortBy, selectedDateFilter, searchQuery]);

  const currentTaskSubtasks = useMemo(() => { 
      if (!editingTask) return []; 
      return tasks.filter(t => t.parentTaskId === editingTask.id); 
  }, [tasks, editingTask]);
  
  const completionRate = activeRootTasks.length > 0 ? Math.round((activeRootTasks.filter(t=>t.completed).length / activeRootTasks.length) * 100) : 0;

  if (loading) return (
      <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50'}`}>
          <Loader2 className="animate-spin" />
      </div>
  );

  return (
    <div className={`flex h-screen w-full ${isDark ? 'dark bg-[#09090b] text-zinc-100' : 'bg-white text-gray-900'}`}>
       {/* MAIN SIDEBAR */}
       <div className={`flex flex-col border-r transition-all duration-300 ${isSidebarExpanded ? 'w-64' : 'w-16'} ${isDark ? 'border-zinc-800 bg-[#09090b]' : 'border-gray-200 bg-gray-50'}`}>
            <div className="p-4 flex flex-col gap-6">
                <div className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20 text-white">
                            <Layout size={18} />
                        </div>
                        {isSidebarExpanded && <span className="font-semibold">TaskFlow</span>}
                    </div>
                    <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}>
                        {isSidebarExpanded ? <SidebarClose size={18}/> : <SidebarOpen size={18}/>}
                    </button>
                </div>
                
                {/* POMODORO TIMER IN SIDEBAR */}
                <PomodoroTimer isDark={isDark} isSidebarExpanded={isSidebarExpanded} onFocusComplete={handleFocusComplete} />

                <div className="flex flex-col gap-1">
                    <button onClick={() => { setActiveProject(HOME_VIEW); }} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${activeProject.id === HOME_VIEW.id ? 'bg-emerald-600/10 text-emerald-500' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                        <Home size={20} />
                        {isSidebarExpanded && <span className="text-sm font-medium">Inicio</span>}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                     {isSidebarExpanded && (
                        <div className="flex items-center justify-between px-2 mb-2 group">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Proyectos</span>
                                {isProjectsExpanded ? <ChevronDown size={14} className="opacity-50"/> : <ChevronRight size={14} className="opacity-50"/>}
                            </div>
                            <button onClick={() => openProjectModal(null)} className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-black'}`} title="Nuevo Proyecto">
                                <Plus size={14} />
                            </button>
                        </div>
                     )}
                     {(isSidebarExpanded ? isProjectsExpanded : true) && (
                         <div className="space-y-0.5">
                             {projects.filter(p => p.id !== HOME_VIEW.id).map(p => (
                                 <div key={p.id} className="group relative">
                                     <button onClick={() => setActiveProject(p)} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${activeProject.id === p.id ? 'bg-emerald-600/10 text-emerald-500' : isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                                         <FolderOpen size={18} className={activeProject.id === p.id ? 'fill-emerald-600/20' : ''} />
                                         {isSidebarExpanded && <span className="text-sm truncate pr-12">{p.name}</span>}
                                     </button>
                                     {isSidebarExpanded && (
                                         <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={(e) => { e.stopPropagation(); openProjectModal(p); }} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-white hover:bg-zinc-700' : 'text-gray-400 hover:text-black hover:bg-gray-300'}`}>
                                                 <Edit2 size={12} />
                                             </button>
                                             <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p); }} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}>
                                                 <Trash2 size={12} />
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             ))}
                         </div>
                     )}
                </div>
            </div>

            <div className={`p-4 mt-auto border-t flex flex-col gap-2 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                {/* CLOUD / BACKUP / THEME CONTROLS */}
                <div className={`flex gap-1 justify-center ${!isSidebarExpanded && 'flex-col'}`}>
                    <button onClick={() => setIsCloudSyncModalOpen(true)} className={`flex items-center justify-center p-2 rounded-lg transition-all ${isDark ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title="Sincronización Nube"><CloudCog size={18} /></button>
                    {isImporting ? (<div className="flex justify-center p-2"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>) : (
                        <>
                            <button onClick={handleExportPomodoroCSV} disabled={isExportingCSV} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Reporte CSV Pomodoros">{isExportingCSV ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}</button>
                            <button onClick={handleExportData} disabled={isBackingUp} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Descargar Backup">{isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}</button>
                            <label className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Restaurar Backup"><Upload size={18} /><input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileSelect} /></label>
                        </>
                    )}
                </div>
                <button onClick={() => setIsDark(!isDark)} className={`w-full flex items-center justify-center gap-3 p-2 rounded-lg ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-200'}`}>
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
       </div>

       {/* MAIN CONTENT AREA */}
       <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Top Bar for View Switching */}
            <div className={`h-14 border-b flex items-center justify-between px-6 flex-shrink-0 ${isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <h1 className="text-lg font-bold truncate">
                    {activeProject.name}
                </h1>
                
                {/* View Switcher */}
                <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'list' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                    >
                        <List size={14} /> Lista
                    </button>
                    <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'calendar' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                    >
                        <CalendarIcon size={14} /> Calendario
                    </button>
                </div>
            </div>

            {/* CONTENT BODY */}
            {viewMode === 'list' ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL (Project Details) */}
                    {activeProject ? (
                        <div className={`hidden lg:flex lg:w-80 border-r flex-col overflow-y-auto custom-scrollbar p-6 ${isDark ? 'border-zinc-800 bg-[#0c0c0e]' : 'border-gray-200 bg-gray-50'}`}>
                            {activeProject.links && activeProject.links.length > 0 && (
                                <div className="mb-6 flex flex-wrap gap-2">
                                    {activeProject.links.map((link, idx) => (
                                        <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors py-1.5 px-3 rounded-lg border ${isDark ? 'border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800' : 'border-gray-200 bg-white text-emerald-600 hover:bg-gray-50'}`}>
                                            <ExternalLink size={12} /> {link.name || 'Link'}
                                        </a>
                                    ))}
                                </div>
                            )}
                            
                            <MiniCalendar 
                                isDark={isDark} 
                                tasks={activeProject.id === HOME_VIEW.id ? tasks : tasks.filter(t => t.projectId === activeProject.id)} 
                                selectedDate={selectedDateFilter} 
                                onSelectDate={setSelectedDateFilter} 
                            />
                            <PerformanceChart isDark={isDark} completionRate={completionRate} />
                            
                            {/* QUICK NOTES */}
                            {activeProject.id !== HOME_VIEW.id && (
                                <div className={`flex-1 flex flex-col p-4 rounded-2xl border min-h-[150px] transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800 focus-within:border-emerald-500/50' : 'bg-white border-gray-200 shadow-sm focus-within:border-emerald-400'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <StickyNote size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                                        <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Notas Rápidas</h3>
                                    </div>
                                    <textarea 
                                        className={`flex-1 w-full bg-transparent resize-none outline-none text-sm leading-relaxed custom-scrollbar ${isDark ? 'text-zinc-300 placeholder-zinc-700' : 'text-gray-700 placeholder-gray-300'}`}
                                        placeholder="Escribe aquí..."
                                        value={projectNotes}
                                        onChange={(e) => setProjectNotes(e.target.value)}
                                        onBlur={handleSaveNotes}
                                    />
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* RIGHT PANEL (Tasks) */}
                    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-8">
                         <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                    {selectedDateFilter ? `Tareas del ${formatDate(selectedDateFilter)}` : 'Todas las Tareas'}
                                </h2>
                                <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{activeRootTasks.length} tareas encontradas</span>
                            </div>
                            
                            {/* Filters */}
                            <div className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all focus-within:border-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                    <Search size={16} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                                    <input 
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar..."
                                        className={`bg-transparent border-none outline-none text-sm w-24 sm:w-32 ${isDark ? 'text-zinc-200 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`}
                                    />
                                </div>
                                <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                    <button onClick={() => setSortBy('priority')} className={`p-1.5 rounded-md transition-all ${sortBy === 'priority' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><Flag size={14} /></button>
                                    <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                    <button onClick={() => setSortBy('date')} className={`p-1.5 rounded-md transition-all ${sortBy === 'date' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><CalendarIcon size={14} /></button>
                                    <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                    <button onClick={() => setSortBy('created')} className={`p-1.5 rounded-md transition-all ${sortBy === 'created' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}><Clock size={14} /></button>
                                </div>
                                {selectedDateFilter && (
                                    <button onClick={() => setSelectedDateFilter(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                                        <FilterX size={14} />
                                    </button>
                                )}
                            </div>
                         </div>

                         {activeProject.id !== HOME_VIEW.id && (
                             <form onSubmit={handleQuickAddTask} className="mb-8">
                                <div className={`flex items-center gap-3 p-4 rounded-xl border border-dashed transition-all cursor-text ${isDark ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30' : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/10'}`}>
                                    <Plus size={20} className={isDark ? 'text-zinc-600' : 'text-gray-400'} />
                                    <input type="text" value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} className={`bg-transparent border-none outline-none w-full text-[15px] ${isDark ? 'text-zinc-300 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`} placeholder="Añadir tarea..." />
                                </div>
                             </form>
                         )}
                         
                         <div className="space-y-2 pb-20">
                            {activeRootTasks.length === 0 && (
                                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                                    <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}><BarChart3 size={24} /></div>
                                    <p>No hay tareas que coincidan</p>
                                </div>
                            )}
                            {activeRootTasks.filter(t=>!t.completed).map(t => (
                                <TaskItem 
                                    key={t.id} 
                                    task={t} 
                                    onToggle={handleToggleTask} 
                                    onClick={setEditingTask} 
                                    onDelete={handleDeleteTask} 
                                    isDark={isDark} 
                                    showProjectName={activeProject.id === HOME_VIEW.id ? projects.find(p=>p.id===t.projectId)?.name : null}
                                    onOpenChecklist={setChecklistModalTask}
                                />
                            ))}
                            {activeRootTasks.filter(t=>t.completed).length > 0 && (
                                <div className="pt-6">
                                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Completado</h3>
                                    {activeRootTasks.filter(t=>t.completed).map(t => (
                                        <TaskItem 
                                            key={t.id} 
                                            task={t} 
                                            onToggle={handleToggleTask} 
                                            onClick={setEditingTask} 
                                            onDelete={handleDeleteTask} 
                                            isDark={isDark} 
                                            showProjectName={activeProject.id === HOME_VIEW.id ? projects.find(p=>p.id===t.projectId)?.name : null}
                                            onOpenChecklist={setChecklistModalTask}
                                        />
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            ) : (
                <CalendarBoard 
                    tasks={tasks} // Pass ALL tasks to calendar, it handles filtering/view
                    projects={projects.filter(p => p.id !== HOME_VIEW.id)}
                    onUpdateTask={handleUpdateTask}
                    onUpdateTaskTime={handleUpdateTaskTime}
                    isDark={isDark}
                    onEditTask={setEditingTask}
                />
            )}

            {/* DETAILS PANEL (Global) */}
            <div ref={detailsPanelRef} className={`absolute inset-y-0 right-0 w-[400px] border-l shadow-2xl transform transition-transform duration-300 z-30 flex flex-col ${editingTask ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
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

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}>
                                <label className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    <CalendarIcon size={10} /> Fecha & Horario
                                </label>
                                <div className="space-y-3">
                                    <input 
                                        type="date" 
                                        value={editingTask.dueDate || ''} 
                                        onChange={(e) => handleUpdateTaskDetail('dueDate', e.target.value)} 
                                        className={`bg-transparent text-xs w-full outline-none font-medium ${isDark ? 'text-zinc-200 [color-scheme:dark]' : 'text-gray-700 [color-scheme:light]'}`} 
                                    />
                                    <div className={`pt-2 border-t flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                                        <div className="flex flex-col gap-0.5 relative">
                                             <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>inicio</label>
                                             <CustomTimeSelect 
                                                value={editingTask.dueTime}
                                                onChange={(val: string) => handleUpdateTaskDetail('dueTime', val)}
                                                options={TIME_SLOTS}
                                                isDark={isDark}
                                                placeholder="--:--"
                                             />
                                        </div>
                                        <span className={`mb-auto mt-6 ${isDark ? 'text-zinc-700' : 'text-gray-300'}`}>-</span>
                                        <div className="flex flex-col gap-0.5">
                                            <label className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>fin</label>
                                            <CustomTimeSelect 
                                                value={getEndTime(editingTask.dueTime || '00:00', editingTask.duration || 60)}
                                                onChange={(val: string) => {
                                                    const newDuration = calculateDuration(editingTask.dueTime || '00:00', val);
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
                            </div>
                            <div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}>
                                <label className={`text-[10px] font-bold uppercase mb-2 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    <Repeat size={10} /> Repetir
                                </label>
                                <select value={editingTask.recurrence || ''} onChange={(e) => handleUpdateTaskDetail('recurrence', e.target.value)} className={`bg-transparent text-xs w-full outline-none appearance-none mt-1 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                    {Object.entries(RECURRENCE_OPTIONS).map(([key, opt]) => (<option key={key} value={opt.value} className={isDark ? 'bg-zinc-900' : 'bg-white'}>{opt.label}</option>))}
                                </select>
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-2">
                                <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Notas / Descripción</label>
                                 <button
                                    onClick={() => setChecklistModalTask(editingTask)}
                                    className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-black'}`}
                                >
                                    <ClipboardList size={12} /> Abrir Editor Avanzado
                                </button>
                            </div>
                            <textarea value={editingTask.description} onChange={(e) => handleUpdateTaskDetail('description', e.target.value)} className={`w-full rounded-lg p-3 outline-none border transition-colors min-h-[100px] text-sm resize-none ${isDark ? 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50' : 'bg-gray-50 border-gray-100 text-gray-700 placeholder-gray-400 focus:border-emerald-400'}`} placeholder="Añadir descripción..." />
                        </div>
                        
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Subtareas</label>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>{currentTaskSubtasks.length}</span>
                            </div>
                            <div className="space-y-1 mb-3">
                                {currentTaskSubtasks.map(sub => (
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
                    
                    {/* CREATION DATE FOOTER */}
                    <div className={`p-4 border-t text-xs flex justify-between items-center ${isDark ? 'border-zinc-800 text-zinc-600' : 'border-gray-100 text-gray-400'}`}>
                        <span>Creado el {formatCreationDate(editingTask.createdAt)}</span>
                        <button onClick={() => handleDeleteTask(editingTask.id)} className="text-red-400 hover:text-red-300 flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={14} /> Eliminar</button>
                    </div>
                </>
              )}
            </div>
       </div>
       <NotificationToast notification={notification} onClose={() => setNotification(null)} />
       <CloudSyncModal isOpen={isCloudSyncModalOpen} onClose={() => setIsCloudSyncModalOpen(false)} currentUserId={userId} isCustom={!!customUid} onSetCustomId={handleSetCustomId} onClearCustomId={handleClearCustomId} isDark={isDark} onActivateCloudMode={handleActivateCloudMode} />
       <PomodoroLogModal isOpen={pomodoroLogModalOpen} projects={projects} onSave={handleLogPomodoro} onCancel={() => setPomodoroLogModalOpen(false)} isDark={isDark} minutes={completedFocusMinutes} />
       <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({isOpen:false})} isDark={isDark} />
       <TaskNoteModal isOpen={!!checklistModalTask} onClose={() => setChecklistModalTask(null)} task={checklistModalTask} onUpdateNote={handleUpdateNote} isDark={isDark} />
       <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} isDark={isDark} editingProject={editingProject} name={projectName} setName={setProjectName} links={projectLinks} setLinks={setProjectLinks} onSave={handleSaveProject} />
    </div>
  );
};

export default App;