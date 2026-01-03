import { Project, Task } from './types';

// --- Constants ---
export const HOME_VIEW = { 
    id: 'ALL_TASKS_VIEW', 
    name: 'Inicio', 
    description: 'Visión general de todas tus tareas y prioridades.',
    links: [],
    quickNotes: ''
} as Project;

export const PROJECT_COLORS: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
    emerald: { label: 'Esmeralda', dot: 'bg-emerald-500', bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-600 dark:text-emerald-400' },
    blue: { label: 'Azul', dot: 'bg-blue-500', bg: 'bg-blue-500/15', border: 'border-blue-500/50', text: 'text-blue-600 dark:text-blue-400' },
    purple: { label: 'Violeta', dot: 'bg-purple-500', bg: 'bg-purple-500/15', border: 'border-purple-500/50', text: 'text-purple-600 dark:text-purple-400' },
    amber: { label: 'Ámbar', dot: 'bg-amber-500', bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-600 dark:text-amber-400' },
    rose: { label: 'Rosa', dot: 'bg-rose-500', bg: 'bg-rose-500/15', border: 'border-rose-500/50', text: 'text-rose-600 dark:text-rose-400' },
    cyan: { label: 'Cian', dot: 'bg-cyan-500', bg: 'bg-cyan-500/15', border: 'border-cyan-500/50', text: 'text-cyan-600 dark:text-cyan-400' },
    indigo: { label: 'Índigo', dot: 'bg-indigo-500', bg: 'bg-indigo-500/15', border: 'border-indigo-500/50', text: 'text-indigo-600 dark:text-indigo-400' },
    gray: { label: 'Gris', dot: 'bg-gray-500', bg: 'bg-gray-500/15', border: 'border-gray-500/50', text: 'text-gray-600 dark:text-gray-400' }
};

export const PRIORITIES: Record<string, { label: string; color: string; bg: string; border: string; iconColor: string }> = {
  high: { label: 'Alta', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-l-4 border-l-red-500', iconColor: 'fill-red-500' },
  medium: { label: 'Media', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-l-4 border-l-amber-500', iconColor: 'fill-amber-500' },
  low: { label: 'Baja', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-4 border-l-blue-500', iconColor: 'fill-blue-500' },
  none: { label: 'Normal', color: 'text-gray-400', bg: 'bg-gray-100', border: 'border-l-4 border-l-transparent', iconColor: 'fill-transparent' }
};

export const RECURRENCE_OPTIONS: Record<string, { label: string; value: string }> = {
    none: { label: 'No repetir', value: '' },
    daily: { label: 'Diariamente', value: 'daily' },
    weekly: { label: 'Semanalmente', value: 'weekly' },
    monthly: { label: 'Mensualmente', value: 'monthly' },
    yearly: { label: 'Anualmente', value: 'yearly' }
};

export const ALARM_SOUNDS: Record<string, { name: string; url: string }> = {
  bell: { name: 'Campana', url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' }, 
  beep: { name: 'Digital', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
  classic: { name: 'Clásico', url: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
  zen: { name: 'Burbujas (Zen)', url: 'https://actions.google.com/sounds/v1/water/air_bubbles.ogg' }
};

export const TIME_SLOTS = (() => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j += 15) {
            slots.push(`${String(i).padStart(2, '0')}:${String(j).padStart(2, '0')}`);
        }
    }
    return slots;
})();

export const workerCode = `self.onmessage = function(e) { if (e.data === 'start') { if (self.timerId) clearInterval(self.timerId); self.timerId = setInterval(function() { postMessage('tick'); }, 1000); } else if (e.data === 'stop') { if (self.timerId) clearInterval(self.timerId); } };`;

// --- Helper Functions ---
export const safeDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val.seconds !== undefined) return new Date(val.seconds * 1000); 
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

export const parseLocalDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  return new Date(dateString + 'T00:00:00');
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
};

export const formatCreationDate = (timestamp: any): string => {
  const date = safeDate(timestamp);
  if (!date) return 'Reciente';
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
  });
};

export const getDaysOpen = (createdAt: any): number => {
    if (!createdAt) return 0;
    const created = safeDate(createdAt);
    if (!created) return 0;
    const diff = new Date().setHours(0,0,0,0) - new Date(created).setHours(0,0,0,0);
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export const isOverdue = (dateString: string): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dateString);
  if (!due) return false;
  return due < today;
};

export const isDueToday = (dateString: string): boolean => {
  if (!dateString) return false;
  const today = new Date();
  const due = parseLocalDate(dateString);
  if (!due) return false;
  return (
    today.getDate() === due.getDate() &&
    today.getMonth() === due.getMonth() &&
    today.getFullYear() === due.getFullYear()
  );
};

// Adjust a date to the next business day (Mon-Fri) if it falls on a weekend
const adjustToBusinessDay = (date: Date): Date => {
    const day = date.getDay();
    if (day === 6) { // Saturday
        date.setDate(date.getDate() + 2); // Move to Monday
    } else if (day === 0) { // Sunday
        date.setDate(date.getDate() + 1); // Move to Monday
    }
    return date;
};

export const calculateNextDueDate = (currentDateStr: string, recurrenceType: string): string | null => {
    let baseDate = currentDateStr ? parseLocalDate(currentDateStr) : new Date();
    if (!baseDate) baseDate = new Date();
    const nextDate = new Date(baseDate);

    switch (recurrenceType) {
        case 'daily': 
            nextDate.setDate(baseDate.getDate() + 1); 
            break;
        case 'weekly': 
            nextDate.setDate(baseDate.getDate() + 7); 
            break;
        case 'monthly': 
            const d = baseDate.getDate();
            nextDate.setMonth(baseDate.getMonth() + 1); 
            if (nextDate.getDate() !== d) {
                 nextDate.setDate(0); 
            }
            break;
        case 'yearly': 
            nextDate.setFullYear(baseDate.getFullYear() + 1); 
            break;
        default: return null;
    }
    
    // Apply Business Day Logic
    const businessDate = adjustToBusinessDay(nextDate);
    
    const y = businessDate.getFullYear();
    const m = String(businessDate.getMonth() + 1).padStart(2, '0');
    const d = String(businessDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getEndTime = (start: string, durationMinutes: number) => {
    if (!start) return '';
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

export const calculateDuration = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 60;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    if (endMins < startMins) endMins += 24 * 60;
    return Math.max(15, endMins - startMins);
};

export const getMonday = (d: Date) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

// --- ICS PARSER (Outlook/Google) ---
export const parseICS = (icsContent: string): Partial<Task>[] => {
    const events: Partial<Task>[] = [];
    const lines = icsContent.split(/\r\n|\n|\r/);
    let currentEvent: any = null;
    let inEvent = false;

    // Helper to parse ICS Date String (e.g., 20231208T140000Z)
    const parseICSDate = (dateStr: string) => {
        if (!dateStr) return null;
        // Clean key params like ;TZID=...
        const cleanDateStr = dateStr.split(':').pop() || '';
        
        const year = cleanDateStr.substring(0, 4);
        const month = cleanDateStr.substring(4, 6);
        const day = cleanDateStr.substring(6, 8);
        const hour = cleanDateStr.substring(9, 11);
        const min = cleanDateStr.substring(11, 13);
        
        // This is a naive parse assuming local time match or ignoring timezone complexity for MVP
        // Ideal solution requires full TZ parsing library
        return new Date(`${year}-${month}-${day}T${hour || '00'}:${min || '00'}:00`);
    };

    lines.forEach(line => {
        if (line.startsWith('BEGIN:VEVENT')) {
            inEvent = true;
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            inEvent = false;
            if (currentEvent && currentEvent.summary && currentEvent.dtstart) {
                const start = parseICSDate(currentEvent.dtstart);
                const end = parseICSDate(currentEvent.dtend);
                
                if (start) {
                    const dateStr = start.toISOString().split('T')[0];
                    const timeStr = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
                    
                    let duration = 60;
                    if (end) {
                        const diffMs = end.getTime() - start.getTime();
                        duration = Math.floor(diffMs / 60000);
                    }

                    events.push({
                        id: `ics_${Math.random().toString(36).substr(2, 9)}`,
                        title: currentEvent.summary,
                        description: currentEvent.description || 'Evento externo',
                        dueDate: dateStr,
                        dueTime: timeStr,
                        duration: duration,
                        projectId: 'OUTLOOK_CALENDAR',
                        completed: false,
                        isExternal: true, // Marker for styling
                        priority: 'none',
                        recurrence: 'none',
                        noteContent: ''
                    });
                }
            }
            currentEvent = null;
        } else if (inEvent) {
            if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
            if (line.startsWith('DTSTART')) currentEvent.dtstart = line;
            if (line.startsWith('DTEND')) currentEvent.dtend = line;
            if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
        }
    });

    return events;
};