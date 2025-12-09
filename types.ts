export interface Project {
    id: string;
    name: string;
    links?: { name: string; url: string }[];
    link?: string; // Legacy support
    quickNotes?: string;
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
    parentTaskId: string | null;
    priority: 'high' | 'medium' | 'low' | 'none';
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    noteContent: string;
    createdAt?: any;
    completedAt?: any;
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