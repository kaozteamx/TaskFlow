import { useState, useRef } from 'react';
import { db, doc, serverTimestamp, writeBatch, getDocs, __app_id } from '../firebase-setup';
import { Project, Task, NotificationType } from '../types';
import { safeDate } from '../utils';

export const useCloudSync = (
    authUser: any,
    userId: string | null | undefined,
    getCollectionRef: (name: string) => any,
    setNotification: (n: NotificationType) => void,
    setConfirmModal: (modal: any) => void,
    projects: Project[],
    handleSetCustomId: (id: string) => void,
    handleClearCustomId: () => void
) => {
    const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importPendingDataRef = useRef<any>(null);

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
                projects: projectsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
                tasks: tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
                pomodoro_logs: logsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
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
            link.download = `pomodoro_report_${new Date().toISOString().slice(0, 10)}.csv`;
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
                    parentTaskId: t.parentTaskId || null
                });
                count++; if (count >= 450) pushBatch();
            }
            if (data.pomodoro_logs && Array.isArray(data.pomodoro_logs)) { for (const l of data.pomodoro_logs) { const logId = l.id || doc(logCol).id; const ref = doc(logCol, logId); currentBatch.set(ref, { projectId: l.projectId, durationMinutes: l.durationMinutes, createdAt: safeDate(l.createdAt) || new Date() }); count++; if (count >= 450) pushBatch(); } }
            if (count > 0) chunks.push(currentBatch); await Promise.all(chunks.map((b: any) => b.commit()));
            setNotification({ type: 'success', message: 'Restauración completa' });
        } catch (err: any) { setNotification({ type: 'error', message: `Error: ${err.message}` }); } finally { setIsImporting(false); }
    };

    const handleFileSelect = (e: any) => {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (event: any) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) { setNotification({ type: 'error', message: 'Formato inválido' }); return; }
                importPendingDataRef.current = data;
                setConfirmModal({ isOpen: true, title: 'Restaurar Backup', message: `Se cargarán ${data.projects.length} proyectos y ${data.tasks.length} tareas. ¿Continuar?`, confirmText: 'Restaurar', onConfirm: executeImport });
            } catch (err) { setNotification({ type: 'error', message: 'Error al leer archivo' }); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
        }; reader.readAsText(file);
    };

    return {
        isCloudSyncModalOpen,
        setIsCloudSyncModalOpen,
        isBackingUp,
        isExportingCSV,
        isImporting,
        fileInputRef,
        handleActivateCloudMode,
        handleExportData,
        handleExportPomodoroCSV,
        handleFileSelect,
        handleSetCustomId,
        handleClearCustomId
    };
};
