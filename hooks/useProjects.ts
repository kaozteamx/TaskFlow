import { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch } from '../firebase-setup';
import { Project, Task, NotificationType } from '../types';
import { HOME_VIEW } from '../utils';
import { IS_DEMO } from '../firebase-setup';

export const useProjects = (
    userId: string | null | undefined,
    getCollectionRef: (name: string) => any,
    setNotification: (n: NotificationType) => void,
    setConfirmModal: (modal: any) => void,
    tasks: Task[]
) => {
    const [projects, setProjects] = useState<Project[]>([HOME_VIEW]);
    const [activeProject, setActiveProject] = useState<Project>(HOME_VIEW);

    // Project Modal States
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [projectName, setProjectName] = useState('');
    const [projectLinks, setProjectLinks] = useState<{ name: string, url: string }[]>([{ name: '', url: '' }]);
    const [projectColor, setProjectColor] = useState('gray');

    // Project Notes States
    const [projectNotes, setProjectNotes] = useState('');
    const prevProjectIdRef = useRef<string | null>(null);

    // Sync Projects from Firebase
    useEffect(() => {
        if (!userId && !IS_DEMO) return;
        const targetProjectsRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
        const unsubProjects = onSnapshot(query(targetProjectsRef), (snap: any) => {
            const list = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
            setProjects([HOME_VIEW, ...list]);
            if (activeProject && activeProject.id !== HOME_VIEW.id) {
                const updated = list.find((p: any) => p.id === activeProject.id);
                if (updated) setActiveProject(updated);
                else setActiveProject(HOME_VIEW);
            }
        });
        return () => unsubProjects();
    }, [userId, getCollectionRef, activeProject?.id]);

    // Sync Project Notes
    useEffect(() => {
        if (activeProject && activeProject.id !== HOME_VIEW.id) {
            if (prevProjectIdRef.current !== activeProject.id) {
                setProjectNotes(activeProject.quickNotes || '');
                prevProjectIdRef.current = activeProject.id;
            }
        }
    }, [activeProject]);

    const handleSaveNotes = async () => {
        if (!activeProject || activeProject.id === HOME_VIEW.id || (!userId && !IS_DEMO)) return;
        if (projectNotes === (activeProject.quickNotes || '')) return;
        const colRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
        try { await updateDoc(doc(colRef, activeProject.id), { quickNotes: projectNotes }); }
        catch (error) { console.error("Error saving notes:", error); }
    };

    const openProjectModal = (proj: Project | null) => {
        if (proj) {
            setEditingProject(proj);
            setProjectName(proj.name);
            setProjectColor(proj.color || 'gray');
            setProjectLinks(proj.links || (proj.link ? [{ name: 'Recurso', url: proj.link }] : [{ name: '', url: '' }]));
        } else {
            setEditingProject(null);
            setProjectName('');
            setProjectColor('emerald');
            setProjectLinks([{ name: '', url: '' }]);
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
            confirmText: 'Eliminar',
            onConfirm: async () => {
                const pRef = userId ? getCollectionRef('projects') : collection(db, 'projects');
                const tRef = userId ? getCollectionRef('tasks') : collection(db, 'tasks');

                // Delete Project
                await deleteDoc(doc(pRef, proj.id));

                // Delete associated tasks using batch for optimization (fixes loop sequentially deleting)
                const projTasks = tasks.filter(t => t.projectId === proj.id);
                const batch = writeBatch(db);
                projTasks.forEach(t => batch.delete(doc(tRef, t.id)));
                await batch.commit();

                if (activeProject.id === proj.id) setActiveProject(HOME_VIEW);
                setConfirmModal({ isOpen: false });
                setNotification({ type: 'success', message: 'Proyecto eliminado' });
            }
        });
    };

    return {
        projects,
        activeProject,
        setActiveProject,
        isProjectModalOpen,
        setIsProjectModalOpen,
        editingProject,
        projectName,
        setProjectName,
        projectLinks,
        setProjectLinks,
        projectColor,
        setProjectColor,
        projectNotes,
        setProjectNotes,
        handleSaveNotes,
        openProjectModal,
        handleSaveProject,
        handleDeleteProject
    };
};
