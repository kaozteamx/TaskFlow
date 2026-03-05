import { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp } from '../firebase-setup';
import { Task, Project, NotificationType } from '../types';
import { HOME_VIEW, IS_DEMO, calculateNextDueDate } from '../utils';

export const useTasks = (
    userId: string | null | undefined,
    getCollectionRef: (name: string) => any,
    setNotification: (n: NotificationType) => void,
    setConfirmModal: (modal: any) => void,
    projects: Project[],
    activeProject: Project,
    setLoading: (l: boolean) => void
) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Sync from Firebase
    useEffect(() => {
        if (!userId && !IS_DEMO) {
            setLoading(false);
            return;
        }
        const targetTasksRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
        const unsubTasks = onSnapshot(query(targetTasksRef), (snap: any) => {
            const list = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
            setTasks(list);
            setLoading(false);
        });
        return () => unsubTasks();
    }, [userId, getCollectionRef]);

    const handleUpdateNote = async (taskId: string, newNoteContent: string) => {
        const colRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
        await updateDoc(doc(colRef, taskId), { noteContent: newNoteContent });
        if (editingTask && editingTask.id === taskId) {
            setEditingTask((prev) => prev ? { ...prev, noteContent: newNoteContent } : null);
        }
    };

    const handleUpdateTask = async (id: string, date: string | null) => {
        const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
        const updates: any = { dueDate: date };
        if (!date) {
            updates.dueTime = '';
            updates.duration = 60;
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
        if (!editingTask || editingTask.isExternal) return;
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
        if (editingTask && editingTask.id === taskId) {
            setEditingTask(prev => prev ? ({ ...prev, projectId: targetProjectId }) : null);
        }
    };

    const handleToggleTask = async (task: Task) => {
        if (task.isExternal) return;
        const ref = userId ? getCollectionRef('tasks') : collection(db, 'tasks');
        const isCompleting = !task.completed;

        await updateDoc(doc(ref, task.id), {
            completed: isCompleting,
            status: isCompleting ? 'done' : 'todo',
            completedAt: isCompleting ? serverTimestamp() : null
        });

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
            else { setNotification({ type: 'error', message: 'Crea un proyecto primero' }); return; }
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
        const todayString = now.toDateString();
        const lastReview = task.lastReviewedAt ? new Date(task.lastReviewedAt).toDateString() : null;
        const newReviewDate = lastReview === todayString ? null : now.toISOString();

        await updateDoc(doc(ref, task.id), {
            lastReviewedAt: newReviewDate
        });
    };

    const handleQuickAddTask = async (e: React.FormEvent, quickTaskTitle: string, selectedDateFilter: string | null) => {
        e.preventDefault();
        if (!quickTaskTitle.trim()) return false;
        let targetProjectId = activeProject.id;
        if (targetProjectId === HOME_VIEW.id) {
            if (projects.length > 1) targetProjectId = projects[1].id;
            else { setNotification({ type: 'error', message: 'Crea un proyecto primero' }); return false; }
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
            recurrence: 'none'
        });
        return true; // Use this to clear Title in component
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

    return {
        tasks,
        editingTask,
        setEditingTask,
        handleUpdateNote,
        handleUpdateTask,
        handleUpdateTaskTime,
        handleUpdateTaskDetail,
        handleReparentTask,
        handleMoveTaskToProject,
        handleToggleTask,
        handleUpdateTaskStatus,
        handleKanbanQuickAdd,
        handleDeleteTask,
        handleToggleReview,
        handleQuickAddTask,
        handleAddSubtask
    };
};
