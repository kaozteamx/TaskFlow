import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, Loader2, Calendar as CalendarIcon, 
  List, BarChart3, Search, FilterX, StickyNote, Flag, ExternalLink, Clock, LogOut, Layout,
  AlertTriangle, Copy, Check, WifiOff, Link, ChevronUp, ChevronDown, ChevronRight, Kanban
} from 'lucide-react';

// --- Imports from Refactored Modules ---
import { auth, db, signInAnonymously, signInWithGoogle, signOut, onAuthStateChanged, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch, getDocs, IS_DEMO, __app_id } from './firebase-setup';
import { Project, Task, NotificationType } from './types';
import { 
  HOME_VIEW, safeDate, formatDate, calculateNextDueDate, calculateDuration 
} from './utils';

// --- Component Imports ---
import { NotificationToast, MiniCalendar, PerformanceChart } from './components/ui-elements';
import { ConfirmationModal, CloudSyncModal, PomodoroLogModal, ProjectModal } from './components/modals';
import { TaskNoteModal } from './components/task-note-modal';
import { CalendarBoard } from './components/calendar-board';
import { KanbanBoard } from './components/kanban-board';
import { TaskItem } from './components/task-item';
import { Sidebar } from './components/sidebar';
import { DetailsPanel } from './components/details-panel';

const App = () => {
  const [authUser, setAuthUser] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [customUid, setCustomUid] = useState<string | null>(() => localStorage.getItem('taskflow_custom_uid'));
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState<Project>(HOME_VIEW);
  const [isDark, setIsDark] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'board'>('list');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Estado para el botón de login
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [checklistModalTask, setChecklistModalTask] = useState<Task | null>(null);
  
  // Project Management States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectLinks, setProjectLinks] = useState<{name:string, url:string}[]>([{name:'', url:''}]);
  const [projectColor, setProjectColor] = useState('gray');

  // List View States
  const [projectNotes, setProjectNotes] = useState('');
  const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false); // State for collapsible completed tasks
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
  const [copied, setCopied] = useState(false);

  // Sync authUser to user
  useEffect(() => { setUser(authUser); }, [authUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: any) => {
      setAuthUser(u);
      setAuthLoading(false); // Auth check complete
      if (u) setIsLoggingIn(false); // Si entra usuario, dejamos de cargar login
    });
    return unsubscribe;
  }, []);

  const userId = useMemo(() => customUid || authUser?.uid, [customUid, authUser]);

  const getCollectionRef = (collectionName: string) => {
      if (customUid) {
          return collection(db, 'artifacts', __app_id, 'public', 'data', `${collectionName}_${customUid}`);
      }
      if (!authUser?.uid) return collection(db, collectionName); 
      // Esta línea es la clave: guarda los datos anidados bajo el UID del usuario de Google
      return collection(db, 'artifacts', __app_id, 'users', authUser.uid, collectionName);
  };

  useEffect(() => {
    // Si no hay usuario y no estamos en demo pura (mock local), no cargamos datos
    if (!userId && !IS_DEMO) {
        setLoading(false);
        return;
    }
    
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
      setIsResourcesExpanded(false);
  }, [activeProject]);

  // Handle click outside details panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (editingTask && detailsPanelRef.current && !detailsPanelRef.current.contains(event.target as Node)) {
            // Check if we are dragging, if so, don't close
            // This is a simple heuristic: if a drag operation is active, usually we don't want to close panel on outside click immediately
            // But since drag events are specific, we will just let it be. 
            // Users usually don't click outside while dragging.
            setEditingTask(null);
        }
    };
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
  
  const handleReparentTask = async (childTaskId: string, newParentId: string) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await updateDoc(doc(ref, childTaskId), { parentTaskId: newParentId });
      setNotification({ type: 'success', message: 'Subtarea asignada correctamente' });
  };
  
  const handleMoveTaskToProject = async (taskId: string, targetProjectId: string) => {
      if (!taskId || !targetProjectId) return;
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await updateDoc(doc(ref, taskId), { projectId: targetProjectId });
      setNotification({ type: 'success', message: 'Tarea movida de proyecto' });
      // If the task was being edited, close it or update it locally to avoid confusion
      if (editingTask && editingTask.id === taskId) {
          setEditingTask(prev => prev ? ({...prev, projectId: targetProjectId}) : null);
      }
  };

  const handleToggleTask = async (task: Task) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      const isCompleting = !task.completed;

      await updateDoc(doc(ref, task.id), { 
          completed: isCompleting,
          status: isCompleting ? 'done' : 'todo', // Reset status if unchecking, set done if checking
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
                  status: 'todo',
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

  // Kanban Status Update
  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      const updates: any = { status: newStatus };
      
      if (newStatus === 'done') {
          updates.completed = true;
          updates.completedAt = serverTimestamp();
      } else {
          updates.completed = false;
          updates.completedAt = null;
      }
      
      await updateDoc(doc(ref, taskId), updates);
  };

  const handleKanbanQuickAdd = async (status: 'todo' | 'in_progress') => {
      const title = prompt("Nueva tarea:");
      if (!title) return;
      
      let targetProjectId = activeProject.id;
      if (targetProjectId === HOME_VIEW.id) { 
          if (projects.length > 1) targetProjectId = projects[1].id; 
          else { setNotification({type:'error', message:'Crea un proyecto primero'}); return; }
      }

      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      await addDoc(ref, { 
          projectId: targetProjectId, 
          title: title, 
          completed: false, 
          status: status,
          createdAt: serverTimestamp(),
          priority: 'medium',
          dueDate: '',
          noteContent: '',
          recurrence: 'none'
      });
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

  const handleToggleReview = async (task: Task) => {
      const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
      const now = new Date();
      const todayString = now.toDateString(); // "Mon Dec 08 2025"
      
      const lastReview = task.lastReviewedAt ? new Date(task.lastReviewedAt).toDateString() : null;
      
      // If already reviewed today, toggle OFF (null). If not reviewed today, toggle ON (ISO string)
      const newReviewDate = lastReview === todayString ? null : now.toISOString();

      await updateDoc(doc(ref, task.id), { 
          lastReviewedAt: newReviewDate
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
          status: 'todo',
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
          status: 'todo',
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
          setProjectColor(proj.color || 'gray');
          setProjectLinks(proj.links || (proj.link ? [{name:'Recurso', url:proj.link}] : [{name:'', url:''}]));
      } else {
          setEditingProject(null);
          setProjectName('');
          setProjectColor('emerald');
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
              await updateDoc(doc(colRef, editingProject.id), { name: projectName, links: validLinks, color: projectColor });
              setNotification({ type: 'success', message: 'Proyecto actualizado' });
          } else {
              await addDoc(colRef, { name: projectName, links: validLinks, createdAt: serverTimestamp(), quickNotes: '', color: projectColor });
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
          // Copiar datos del espacio privado (uid) al espacio público (uid con sufijo) para compartir
          const projectsSnap = await getDocs(getCollectionRef('projects'));
          const tasksSnap = await getDocs(getCollectionRef('tasks'));
          
          // Nota: El "modo nube" en este contexto crea una copia en una ruta pública 
          // para compartir via ID. Si ya estás logueado con Google, ya estás "en la nube"
          // pero en tu espacio privado.
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
          setNotification({ type: 'success', message: 'Modo Compartido Activado.' });
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
          for (const p of data.projects) { if (!p.id) continue; const ref = doc(projCol, p.id); const created = safeDate(p.createdAt) || new Date(); currentBatch.set(ref, { name: p.name || 'Sin nombre', createdAt: created, quickNotes: p.quickNotes || '', links: p.links || [], color: p.color || 'gray' }); count++; if (count >= 450) pushBatch(); }
          for (const t of data.tasks) { 
              if (!t.id || !t.projectId) continue; 
              const ref = doc(taskCol, t.id); 
              const created = safeDate(t.createdAt) || new Date(); 
              currentBatch.set(ref, { 
                  projectId: t.projectId, 
                  title: t.title, 
                  completed: !!t.completed, 
                  status: t.status || (t.completed ? 'done' : 'todo'),
                  createdAt: created, 
                  dueDate: t.dueDate || '', 
                  dueTime: t.dueTime || '', 
                  duration: t.duration || 60, 
                  noteContent: t.noteContent || '', 
                  description: t.description || '',
                  priority: t.priority || 'medium',
                  recurrence: t.recurrence || 'none',
                  parentTaskId: t.parentTaskId || null // Fix: Ensure parentTaskId is preserved during import
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
  
  const handleSignOut = async () => {
      if (IS_DEMO) localStorage.removeItem('taskflow_force_offline');
      try {
          await signOut();
          setAuthUser(null);
      } catch (error) {
          console.error("Error signing out", error);
      }
  };

  const handleLogin = async () => {
      setIsLoggingIn(true);
      try {
          await signInWithGoogle();
      } catch (error: any) {
          setIsLoggingIn(false);
          if (error.code === 'auth/unauthorized-domain') {
              setNotification({ type: 'warning', message: 'Dominio no autorizado. Activando modo offline...' });
              localStorage.setItem('taskflow_force_offline', 'true');
              setTimeout(() => window.location.reload(), 1500);
          } else if (error.code === 'auth/popup-closed-by-user') {
              setNotification({ type: 'info', message: 'Inicio de sesión cancelado.' });
          } else {
              setNotification({ type: 'error', message: 'No se pudo iniciar sesión. Verifica la consola.' });
          }
      }
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
  
  const completedTasks = useMemo(() => activeRootTasks.filter(t => t.completed), [activeRootTasks]);

  // --- Auth & Loading UI ---

  if (authLoading) return (
      <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50'}`}>
          <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
      </div>
  );

  // LOGIN SCREEN
  if (!authUser && !IS_DEMO) {
      const currentDomain = window.location.hostname;
      
      const handleCopyDomain = () => {
          navigator.clipboard.writeText(currentDomain);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      };

      return (
          <div className={`flex flex-col items-center justify-center h-screen w-full px-4 ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50 text-gray-900'}`}>
              <div className="w-full max-w-sm text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-900/40 text-white mx-auto mb-6">
                        <Layout size={32} />
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Bienvenido a TaskFlow</h1>
                  <p className={`mb-8 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                      Organiza tus tareas, gestiona tu tiempo y sincroniza tus proyectos en la nube.
                  </p>
                  
                  <button 
                    onClick={handleLogin}
                    disabled={isLoggingIn}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} ${isLoggingIn ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                      {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />}
                      {isLoggingIn ? 'Iniciando sesión...' : 'Continuar con Google'}
                  </button>
                  
                  {/* BUTTON TO BYPASS LOGIN (FORCE OFFLINE) */}
                  <button 
                    onClick={() => { localStorage.setItem('taskflow_force_offline', 'true'); window.location.reload(); }}
                    className={`mt-3 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                  >
                    <WifiOff size={20} />
                    Usar Modo Offline
                  </button>

                  <p className={`mt-6 text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                      Si no has configurado Firebase, la app funcionará en modo Demo local.
                  </p>

                  {/* DOMAIN AUTHORIZATION HELPER */}
                  <div className="mt-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left w-full">
                        <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-2 flex items-center gap-1">
                             <AlertTriangle size={12} /> Configuración Requerida
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                            Para usar Google Login, debes autorizar este dominio en Firebase:
                        </p>
                        <div className="flex items-center gap-2 bg-white dark:bg-black/20 p-2 rounded border border-amber-500/10 mb-2">
                             <code className="text-xs font-mono flex-1 truncate select-all">{currentDomain}</code>
                             <button 
                                onClick={handleCopyDomain}
                                className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-500 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
                             >
                                 {copied ? <Check size={10} /> : <Copy size={10} />}
                                 {copied ? 'Copiado' : 'Copiar'}
                             </button>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
                             Ve a <strong>Authentication &gt; Settings &gt; Authorized Domains</strong>. O usa el <strong>Modo Offline</strong>.
                        </p>
                  </div>
              </div>
          </div>
      );
  }

  // APP UI
  if (loading) return (
      <div className={`flex items-center justify-center h-screen ${isDark ? 'bg-[#09090b] text-white' : 'bg-gray-50'}`}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
            <p className="text-sm opacity-50">Sincronizando con la nube...</p>
          </div>
      </div>
  );

  return (
    <div className={`flex h-screen w-full ${isDark ? 'dark bg-[#09090b] text-zinc-100' : 'bg-white text-gray-900'}`}>
       {/* MAIN SIDEBAR */}
       <Sidebar 
            isSidebarExpanded={isSidebarExpanded}
            setIsSidebarExpanded={setIsSidebarExpanded}
            isDark={isDark}
            setIsDark={setIsDark}
            activeProject={activeProject}
            setActiveProject={setActiveProject}
            projects={projects}
            isProjectsExpanded={isProjectsExpanded}
            setIsProjectsExpanded={setIsProjectsExpanded}
            openProjectModal={openProjectModal}
            handleDeleteProject={handleDeleteProject}
            setIsCloudSyncModalOpen={setIsCloudSyncModalOpen}
            isImporting={isImporting}
            isExportingCSV={isExportingCSV}
            handleExportPomodoroCSV={handleExportPomodoroCSV}
            isBackingUp={isBackingUp}
            handleExportData={handleExportData}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            onFocusComplete={handleFocusComplete}
            onMoveTaskToProject={handleMoveTaskToProject}
       />

       {/* MAIN CONTENT AREA */}
       <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Top Bar for View Switching */}
            <div className={`h-14 border-b flex items-center justify-between px-6 flex-shrink-0 ${isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <h1 className="text-lg font-bold truncate">
                    {activeProject.name}
                </h1>
                
                <div className="flex items-center gap-3">
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
                            onClick={() => setViewMode('board')}
                            className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'board' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                        >
                            <Kanban size={14} /> Tablero
                        </button>
                        <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'calendar' ? (isDark ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'bg-gray-100 text-gray-800 shadow-sm') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                        >
                            <CalendarIcon size={14} /> Calendario
                        </button>
                    </div>

                    {/* User Profile / Logout */}
                    {authUser && (
                        <div className="flex items-center gap-2 border-l pl-3 ml-2 border-gray-200 dark:border-zinc-800">
                             {authUser.photoURL && (
                                 <img src={authUser.photoURL} alt="Avatar" className="w-7 h-7 rounded-full" />
                             )}
                             <button onClick={handleSignOut} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-red-900/30 text-zinc-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`} title="Cerrar Sesión">
                                 <LogOut size={16} />
                             </button>
                        </div>
                    )}
                    {IS_DEMO && (
                        <div className="flex items-center gap-2 border-l pl-3 ml-2 border-gray-200 dark:border-zinc-800">
                             <button 
                                onClick={() => { localStorage.removeItem('taskflow_force_offline'); window.location.reload(); }}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${isDark ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-400' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-600'}`}
                             >
                                 Conectar Cuenta
                             </button>
                        </div>
                    )}
                </div>
            </div>

            {/* CONTENT BODY */}
            {viewMode === 'list' ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL (Project Details) */}
                    {activeProject ? (
                        <div className={`hidden lg:flex lg:w-80 border-r flex-col overflow-y-auto custom-scrollbar p-6 ${isDark ? 'border-zinc-800 bg-[#0c0c0e]' : 'border-gray-200 bg-gray-50'}`}>
                            {activeProject.links && activeProject.links.length > 0 && (
                                <div className="mb-6">
                                    <button 
                                        onClick={() => setIsResourcesExpanded(!isResourcesExpanded)}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-md ${isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                <Link size={14} />
                                            </div>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                                Recursos ({activeProject.links.length})
                                            </span>
                                        </div>
                                        {isResourcesExpanded ? <ChevronUp size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'}/> : <ChevronDown size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'}/>}
                                    </button>
                                    
                                    {isResourcesExpanded && (
                                        <div className={`mt-2 flex flex-col gap-1 p-1 rounded-lg border animate-in fade-in slide-in-from-top-2 duration-200 ${isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                            {activeProject.links.map((link, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={link.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400' : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-emerald-600'}`}
                                                >
                                                    <span className="truncate">{link.name || 'Enlace sin nombre'}</span>
                                                    <ExternalLink size={12} className="opacity-50" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
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
                            {activeRootTasks.filter(t=>!t.completed).map(t => {
                                const subtasks = tasks.filter(sub => sub.parentTaskId === t.id);
                                const completedSubCount = subtasks.filter(sub => sub.completed).length;
                                return (
                                <TaskItem 
                                    key={t.id} 
                                    task={t} 
                                    onToggle={handleToggleTask} 
                                    onClick={setEditingTask} 
                                    onDelete={handleDeleteTask} 
                                    isDark={isDark} 
                                    showProjectName={activeProject.id === HOME_VIEW.id ? (projects.find(p=>p.id===t.projectId)?.name || null) : null}
                                    onOpenChecklist={setChecklistModalTask}
                                    onToggleReview={handleToggleReview}
                                    subtasksCount={subtasks.length}
                                    subtasksCompletedCount={completedSubCount}
                                />
                            )})}
                            
                            {completedTasks.length > 0 && (
                                <div className="pt-6">
                                    <button 
                                        onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                                        className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-4 transition-colors ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {isCompletedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        Completado ({completedTasks.length})
                                    </button>
                                    
                                    {isCompletedExpanded && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                            {completedTasks.map(t => {
                                                const subtasks = tasks.filter(sub => sub.parentTaskId === t.id);
                                                const completedSubCount = subtasks.filter(sub => sub.completed).length;
                                                return (
                                                <TaskItem 
                                                    key={t.id} 
                                                    task={t} 
                                                    onToggle={handleToggleTask} 
                                                    onClick={setEditingTask} 
                                                    onDelete={handleDeleteTask} 
                                                    isDark={isDark} 
                                                    showProjectName={activeProject.id === HOME_VIEW.id ? (projects.find(p=>p.id===t.projectId)?.name || null) : null}
                                                    onOpenChecklist={setChecklistModalTask}
                                                    onToggleReview={handleToggleReview}
                                                    subtasksCount={subtasks.length}
                                                    subtasksCompletedCount={completedSubCount}
                                                />
                                            )})}
                                        </div>
                                    )}
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            ) : viewMode === 'board' ? (
                <KanbanBoard 
                    tasks={activeRootTasks} // Uses same filtering as List view
                    projects={projects}
                    isDark={isDark}
                    onUpdateStatus={handleUpdateTaskStatus}
                    onEditTask={setEditingTask}
                    onQuickAdd={handleKanbanQuickAdd}
                />
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
            <DetailsPanel 
                editingTask={editingTask}
                setEditingTask={setEditingTask}
                isDark={isDark}
                handleToggleTask={handleToggleTask}
                handleUpdateTaskDetail={handleUpdateTaskDetail}
                handleDeleteTask={handleDeleteTask}
                currentTaskSubtasks={currentTaskSubtasks}
                handleAddSubtask={handleAddSubtask}
                setChecklistModalTask={setChecklistModalTask}
                panelRef={detailsPanelRef}
                onReparentTask={handleReparentTask}
            />
       </div>
       <NotificationToast notification={notification} onClose={() => setNotification(null)} />
       <CloudSyncModal isOpen={isCloudSyncModalOpen} onClose={() => setIsCloudSyncModalOpen(false)} currentUserId={userId} isCustom={!!customUid} onSetCustomId={handleSetCustomId} onClearCustomId={handleClearCustomId} isDark={isDark} onActivateCloudMode={handleActivateCloudMode} />
       <PomodoroLogModal isOpen={pomodoroLogModalOpen} projects={projects} onSave={handleLogPomodoro} onCancel={() => setPomodoroLogModalOpen(false)} isDark={isDark} minutes={completedFocusMinutes} />
       <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({isOpen:false})} isDark={isDark} />
       <TaskNoteModal isOpen={!!checklistModalTask} onClose={() => setChecklistModalTask(null)} task={checklistModalTask} onUpdateNote={handleUpdateNote} isDark={isDark} />
       <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} isDark={isDark} editingProject={editingProject} name={projectName} setName={setProjectName} links={projectLinks} setLinks={setProjectLinks} color={projectColor} setColor={setProjectColor} onSave={handleSaveProject} />
    </div>
  );
};

export default App;