import { Timestamp, FieldValue } from 'firebase/firestore';

export interface Project {
    id: string;
    name: string;
    links?: { name: string; url: string }[];
    link?: string; // Legacy support
    quickNotes?: string;
    color?: string; // 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'cyan' | 'indigo'
    createdAt?: Timestamp | FieldValue | Date | string;
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
    status?: 'todo' | 'in_progress' | 'done' | 'do_first' | 'schedule' | 'delegate' | 'eliminate';
    parentTaskId: string | null;
    priority: 'high' | 'medium' | 'low' | 'none';
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    timeSpent?: number; // Total accumulated time in seconds
    trackingStartedAt?: number | null; // Timestamp (Date.now()) if currently tracking, else null
    noteContent: string;
    lastReviewedAt?: string; // ISO String of last review time
    createdAt?: Timestamp | FieldValue | Date | string;
    completedAt?: Timestamp | FieldValue | Date | string;
    isExternal?: boolean; // New: For ICS events
    attachment?: string; // New: Base64 image string
}

export interface PomodoroLog {
    id: string;
    projectId: string;
    durationMinutes: number;
    createdAt: Timestamp | FieldValue | Date | string;
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