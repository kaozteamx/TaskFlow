export interface Project {
    id: string;
    name: string;
    links?: { name: string; url: string }[];
    link?: string; // Legacy support
    quickNotes?: string;
    color?: string; // 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'cyan' | 'indigo'
    createdAt?: any;
}

export interface Task {
    id: string;
    projectId: string;
    title: string;
    description: string;
    dueDate: string; // YYYY-MM-DD
    dueTime?: string; // HH:mm
    duration?: number; // in minutes
    completed: boolean;
    status?: 'todo' | 'in_progress' | 'done'; // Added for Kanban
    parentTaskId: string | null;
    priority: 'high' | 'medium' | 'low' | 'none';
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    noteContent: string;
    lastReviewedAt?: string; // ISO String of last review time
    createdAt?: any;
    completedAt?: any;
    isExternal?: boolean; // New: For ICS events
}

export interface PomodoroLog {
    id: string;
    projectId: string;
    durationMinutes: number;
    createdAt: any;
}

export interface NotificationType {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}

// Declare globals injected via window/HTML
declare global {
    interface Window {
        __firebase_config: string;
        __app_id: string;
        __initial_auth_token?: string;
    }
}