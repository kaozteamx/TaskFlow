import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { 
  Layout, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  FolderOpen,
  X, 
  Edit2, 
  AlertTriangle, 
  Check, 
  GripVertical, 
  Clock, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  BarChart3, 
  Info, 
  Home, 
  SidebarClose, 
  SidebarOpen, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Timer, 
  Coffee,
  Flag,      
  ExternalLink,
  Minus,
  CloudCog, 
  Copy,     
  LogOut,
  Smartphone,
  Laptop,
  Download, 
  Upload,   
  Loader2,
  Share2,
  Globe,
  Repeat, 
  CalendarDays,
  FileSpreadsheet,
  StickyNote,
  FilterX,
  Search,
  Wifi,
  WifiOff,
  ClipboardList,
  CheckSquare, 
  AlignLeft,    
  Calendar, 
  Eraser
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken as fbSignInWithCustomToken, 
  signInAnonymously as fbSignInAnonymously, 
  onAuthStateChanged as fbOnAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection as fbCollection, 
  addDoc as fbAddDoc, 
  updateDoc as fbUpdateDoc, 
  deleteDoc as fbDeleteDoc, 
  doc as fbDoc, 
  onSnapshot as fbOnSnapshot, 
  query as fbQuery, 
  serverTimestamp as fbServerTimestamp,
  writeBatch as fbWriteBatch, 
  getDocs as fbGetDocs,
  CollectionReference
} from 'firebase/firestore';

// Types
import { Project, Task, NotificationType } from './types';

// --- Globals via Window (injected in index.html) ---
declare const window: any;
const __firebase_config = window.__firebase_config;
const __app_id = window.__app_id;
const __initial_auth_token = window.__initial_auth_token;

// --- Configuration & Mock Detection ---
const firebaseConfig = JSON.parse(__firebase_config);
const IS_DEMO = firebaseConfig.apiKey === "demo-key" || !firebaseConfig.apiKey;

// --- Mock Infrastructure (LocalStorage) ---
const getStore = () => JSON.parse(localStorage.getItem('taskflow_db') || '{}');
const setStore = (v: any) => {
    localStorage.setItem('taskflow_db', JSON.stringify(v));
    window.dispatchEvent(new Event('taskflow_db_change'));
};

// Mock Auth
const mockAuthImpl = {
    signInAnonymously: async (auth: any) => {
        const user = { uid: 'demo-user', isAnonymous: true };
        auth.currentUser = user;
        setTimeout(() => window.dispatchEvent(new Event('taskflow_auth_change')), 10);
        return { user };
    },
    signInWithCustomToken: async (auth: any, token: string) => {
        const user = { uid: 'demo-user', isAnonymous: false };
        auth.currentUser = user;
        setTimeout(() => window.dispatchEvent(new Event('taskflow_auth_change')), 10);
        return { user };
    },
    onAuthStateChanged: (auth: any, cb: any) => {
        cb(auth.currentUser);
        const handler = () => cb(auth.currentUser);
        window.addEventListener('taskflow_auth_change', handler);
        return () => window.removeEventListener('taskflow_auth_change', handler);
    }
};

// Mock Firestore
const mockFirestoreImpl = {
    collection: (db: any, ...pathSegments: string[]) => {
        return { type: 'collection', path: pathSegments.join('/') };
    },
    doc: (ref: any, ...pathSegments: string[]) => {
        let path = '';
        if (ref.type === 'mock_db') path = pathSegments.join('/');
        else if (ref.type === 'collection') path = `${ref.path}/${pathSegments[0]}`;
        else path = ref.path; // already a doc ref
        
        // Handle case where doc is called on db with a full path
        if (ref.type === 'mock_db' && pathSegments.length === 0) path = 'root'; 

        const id = path.split('/').pop();
        return { type: 'doc', path, id };
    },
    addDoc: async (coll: any, data: any) => {
        const id = 'mock_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const store = getStore();
        if (!store[coll.path]) store[coll.path] = [];
        store[coll.path].push({ id, ...data });
        setStore(store);
        return { id, path: `${coll.path}/${id}` };
    },
    updateDoc: async (ref: any, data: any) => {
        const store = getStore();
        const collPath = ref.path.substring(0, ref.path.lastIndexOf('/'));
        const id = ref.path.split('/').pop();
        if (store[collPath]) {
            const idx = store[collPath].findIndex((d: any) => d.id === id);
            if (idx >= 0) {
                store[collPath][idx] = { ...store[collPath][idx], ...data };
                setStore(store);
            }
        }
    },
    deleteDoc: async (ref: any) => {
        const store = getStore();
        const collPath = ref.path.substring(0, ref.path.lastIndexOf('/'));
        const id = ref.path.split('/').pop();
        if (store[collPath]) {
            store[collPath] = store[collPath].filter((d: any) => d.id !== id);
            setStore(store);
        }
    },
    onSnapshot: (queryRef: any, onNext: any, onError: any) => {
        const run = () => {
            const store = getStore();
            const list = store[queryRef.path] || [];
            onNext({
                docs: list.map((d: any) => ({
                    id: d.id,
                    data: () => d
                }))
            });
        };
        run();
        window.addEventListener('taskflow_db_change', run);
        return () => window.removeEventListener('taskflow_db_change', run);
    },
    query: (ref: any) => ref, // Mock ignores query constraints, filtering done in UI
    getDocs: async (queryRef: any) => {
        const store = getStore();
        const list = store[queryRef.path] || [];
        return {
            docs: list.map((d: any) => ({
                id: d.id,
                data: () => d
            })),
            empty: list.length === 0
        };
    },
    writeBatch: (db: any) => {
        const ops: any[] = [];
        return {
            set: (ref: any, data: any) => {
                ops.push(async () => {
                   const store = getStore();
                   const collPath = ref.path.substring(0, ref.path.lastIndexOf('/'));
                   const id = ref.path.split('/').pop();
                   if (!store[collPath]) store[collPath] = [];
                   const idx = store[collPath].findIndex((d: any) => d.id === id);
                   if (idx >= 0) store[collPath][idx] = { ...data, id };
                   else store[collPath].push({ ...data, id });
                   localStorage.setItem('taskflow_db', JSON.stringify(store));
                });
            },
            commit: async () => {
                for (const op of ops) await op();
                window.dispatchEvent(new Event('taskflow_db_change'));
            }
        };
    },
    serverTimestamp: () => new Date() // Mock returns Date object directly
};

// --- Initialization Logic ---
let app, auth: any, db: any;
let signInAnonymously: any, signInWithCustomToken: any, onAuthStateChanged: any;
let collection: any, addDoc: any, updateDoc: any, deleteDoc: any, doc: any, onSnapshot: any, query: any, serverTimestamp: any, writeBatch: any, getDocs: any;

if (!IS_DEMO) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase Init Failed", e);
    }
    signInAnonymously = fbSignInAnonymously;
    signInWithCustomToken = fbSignInWithCustomToken;
    onAuthStateChanged = fbOnAuthStateChanged;
    collection = fbCollection;
    addDoc = fbAddDoc;
    updateDoc = fbUpdateDoc;
    deleteDoc = fbDeleteDoc;
    doc = fbDoc;
    onSnapshot = fbOnSnapshot;
    query = fbQuery;
    serverTimestamp = fbServerTimestamp;
    writeBatch = fbWriteBatch;
    getDocs = fbGetDocs;
} else {
    console.log("TaskFlow: Demo Mode Active (LocalStorage)");
    auth = { currentUser: null };
    db = { type: 'mock_db' };
    signInAnonymously = mockAuthImpl.signInAnonymously;
    signInWithCustomToken = mockAuthImpl.signInWithCustomToken;
    onAuthStateChanged = mockAuthImpl.onAuthStateChanged;
    collection = mockFirestoreImpl.collection;
    addDoc = mockFirestoreImpl.addDoc;
    updateDoc = mockFirestoreImpl.updateDoc;
    deleteDoc = mockFirestoreImpl.deleteDoc;
    doc = mockFirestoreImpl.doc;
    onSnapshot = mockFirestoreImpl.onSnapshot;
    query = mockFirestoreImpl.query;
    serverTimestamp = mockFirestoreImpl.serverTimestamp;
    writeBatch = mockFirestoreImpl.writeBatch;
    getDocs = mockFirestoreImpl.getDocs;
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants ---
const HOME_VIEW = { 
    id: 'ALL_TASKS_VIEW', 
    name: 'Inicio', 
    description: 'Visión general de todas tus tareas y prioridades.',
    links: [],
    quickNotes: ''
} as Project;

const PRIORITIES: Record<string, { label: string; color: string; bg: string; border: string; iconColor: string }> = {
  high: { label: 'Alta', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-l-4 border-l-red-500', iconColor: 'fill-red-500' },
  medium: { label: 'Media', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-l-4 border-l-amber-500', iconColor: 'fill-amber-500' },
  low: { label: 'Baja', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-4 border-l-blue-500', iconColor: 'fill-blue-500' },
  none: { label: 'Normal', color: 'text-gray-400', bg: 'bg-gray-100', border: 'border-l-4 border-l-transparent', iconColor: 'fill-transparent' }
};

const RECURRENCE_OPTIONS: Record<string, { label: string; value: string }> = {
    none: { label: 'No repetir', value: '' },
    daily: { label: 'Diariamente', value: 'daily' },
    weekly: { label: 'Semanalmente', value: 'weekly' },
    monthly: { label: 'Mensualmente', value: 'monthly' },
    yearly: { label: 'Anualmente', value: 'yearly' }
};

const ALARM_SOUNDS: Record<string, { name: string; url: string }> = {
  bell: { name: 'Campana', url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' }, 
  beep: { name: 'Digital', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
  classic: { name: 'Clásico', url: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
  zen: { name: 'Burbujas (Zen)', url: 'https://actions.google.com/sounds/v1/water/air_bubbles.ogg' }
};

// --- Helper Functions ---
const safeDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val.seconds !== undefined) return new Date(val.seconds * 1000); 
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const parseLocalDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  return new Date(dateString + 'T00:00:00');
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
};

const formatCreationDate = (timestamp: any): string => {
  const date = safeDate(timestamp);
  if (!date) return 'Reciente';
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
  });
};

const formatCompletionDate = (timestamp: any): string => {
  const date = safeDate(timestamp);
  if (!date) return '';
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
  });
};

const getDaysRemaining = (dateString: string): number | null => {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dateString);
  if (!due) return 0;
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDaysOpen = (createdAt: any): number => {
    if (!createdAt) return 0;
    const created = safeDate(createdAt);
    if (!created) return 0;
    const diff = new Date().setHours(0,0,0,0) - new Date(created).setHours(0,0,0,0);
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const isOverdue = (dateString: string): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dateString);
  if (!due) return false;
  return due < today;
};

const isDueToday = (dateString: string): boolean => {
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

// --- Helper for Date Calculation ---
const calculateNextDueDate = (currentDateStr: string, recurrenceType: string): string | null => {
    let baseDate = currentDateStr ? parseLocalDate(currentDateStr) : new Date();
    if (!baseDate) baseDate = new Date();
    const nextDate = new Date(baseDate);

    switch (recurrenceType) {
        case 'daily': nextDate.setDate(baseDate.getDate() + 1); break;
        case 'weekly': nextDate.setDate(baseDate.getDate() + 7); break;
        case 'monthly': nextDate.setMonth(baseDate.getMonth() + 1); break;
        case 'yearly': nextDate.setFullYear(baseDate.getFullYear() + 1); break;
        default: return null;
    }
    return nextDate.toISOString().split('T')[0];
};

// --- Components ---

const NotificationToast = ({ notification, onClose }: { notification: NotificationType | null, onClose: () => void }) => {
    if (!notification) return null;
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [notification, onClose]);
    const bgColors = { success: 'bg-emerald-600 border-emerald-500', error: 'bg-red-600 border-red-500', info: 'bg-blue-600 border-blue-500', warning: 'bg-amber-600 border-amber-500' };
    return (
        <div className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white animate-in slide-in-from-top-5 duration-300 border ${bgColors[notification.type] || 'bg-zinc-800'}`}>
            {notification.type === 'success' && <Check size={20} />}
            {notification.type === 'error' && <AlertTriangle size={20} />}
            {notification.type === 'info' && <Info size={20} />}
            <span className="text-sm font-semibold">{notification.message}</span>
            <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100 bg-white/10 p-1 rounded-full"><X size={14}/></button>
        </div>
    );
};

// --- FREESTYLE NOTE MODAL (OVERLAY MODE) ---
const TaskNoteModal = ({ isOpen, onClose, task, onUpdateNote, isDark }: any) => {
    const [content, setContent] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const cursorToSet = useRef<number | null>(null); 

    useEffect(() => {
        if (task) {
            setContent(task.noteContent || '');
        }
    }, [task]);

    useLayoutEffect(() => {
        if (cursorToSet.current !== null && textareaRef.current) {
            textareaRef.current.setSelectionRange(cursorToSet.current, cursorToSet.current);
            cursorToSet.current = null;
        }
    }, [content]);

    if (!isOpen || !task) return null;

    const handleSaveAndClose = () => {
        onUpdateNote(task.id, content);
        onClose();
    };

    const handleScroll = () => {
        if (textareaRef.current && backdropRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const cursor = (e.target as HTMLTextAreaElement).selectionStart;
            const textBefore = content.substring(0, cursor);
            const textAfter = content.substring(cursor);
            const currentLine = textBefore.split('\n').pop() || '';
            
            const match = currentLine.match(/^(\s*)(\[ \] |\[x\] |- )/);
            
            if (match) {
                e.preventDefault();
                const prefix = match[1] + (match[2].includes('[') ? '[ ] ' : match[2]); 
                const newText = textBefore + '\n' + prefix + textAfter;
                setContent(newText);
                cursorToSet.current = cursor + 1 + prefix.length; 
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const start = (e.target as HTMLTextAreaElement).selectionStart;
            const end = (e.target as HTMLTextAreaElement).selectionEnd;
            const newText = content.substring(0, start) + '    ' + content.substring(end);
            setContent(newText);
            cursorToSet.current = start + 4;
        }
    };

    const insertText = (textToInsert: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = content;
        const newText = text.substring(0, start) + textToInsert + text.substring(end);
        setContent(newText);
        cursorToSet.current = start + textToInsert.length;
        el.focus();
    };

    const insertDate = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        insertText(`[${dateStr}] `);
    };

    const clearCompleted = () => {
        const lines = content.split('\n');
        const newContent = lines.filter(line => !line.includes('[x]')).join('\n');
        setContent(newContent);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(content);
    };

    const toggleCheckboxLine = () => {
        const el = textareaRef.current;
        if (!el) return;
        const cursor = el.selectionStart;
        const text = content;
        const lastNewLine = text.lastIndexOf('\n', cursor - 1);
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        const nextNewLine = text.indexOf('\n', cursor);
        const lineEnd = nextNewLine === -1 ? text.length : nextNewLine;
        const line = text.substring(lineStart, lineEnd);
        let newLine = line;
        if (line.includes('[ ]')) newLine = line.replace('[ ]', '[x]');
        else if (line.includes('[x]')) newLine = line.replace('[x]', '[ ]');
        else {
            const match = line.match(/^(\s*)(.*)/);
            if (match) newLine = `${match[1]}[ ] ${match[2]}`;
            else newLine = `[ ] ${line}`;
        }
        const newText = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
        setContent(newText);
        cursorToSet.current = lineStart + newLine.length; 
        el.focus();
    };

    // Render backdrop with highlighted lines
    const renderBackdrop = () => {
        const lines = content.split('\n');
        return lines.map((line, index) => {
            const isChecked = line.includes('[x]');
            const isHeader = line.trim().startsWith('#');
            
            let className = '';
            if (isChecked) className = 'text-[#12B981] line-through opacity-60'; // Verde y tachado
            else if (isHeader) className = 'text-amber-500 font-bold'; // Título

            return (
                <div key={index} className={className}>
                    {line || <br />} 
                </div>
            );
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95" onClick={handleSaveAndClose}>
            <div className={`w-full max-w-3xl h-[80vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#1e1e20] border-zinc-700' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <StickyNote className={isDark ? 'text-amber-500' : 'text-amber-600'} size={20} />
                        <div>
                            <h3 className={`text-base font-bold line-clamp-1 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{task.title}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSaveAndClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100' : 'hover:bg-gray-200 text-gray-500'}`}>
                            <X size={20}/>
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className={`px-4 py-2 border-b flex flex-wrap gap-2 ${isDark ? 'border-zinc-700 bg-[#252527]' : 'border-gray-100 bg-gray-50'}`}>
                    <button onClick={() => insertText('[ ] ')} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-600 hover:bg-gray-200'}`} title="Insertar Checkbox">
                        <CheckSquare size={16} /> <span>Checkbox</span>
                    </button>
                    <button onClick={toggleCheckboxLine} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-600 hover:bg-gray-200'}`} title="Marcar/Desmarcar (o poner cursor sobre línea)">
                        <Check size={16} />
                    </button>
                    <div className={`w-px h-5 my-auto ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                    <button onClick={() => insertText('    ')} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-600 hover:bg-gray-200'}`} title="Indentar">
                        <AlignLeft size={16} />
                    </button>
                    <button onClick={insertDate} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-600 hover:bg-gray-200'}`} title="Insertar Fecha">
                        <Calendar size={16} />
                    </button>
                    <div className={`w-px h-5 my-auto ${isDark ? 'bg-zinc-700' : 'bg-gray-300'}`} />
                    <button onClick={copyToClipboard} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'text-zinc-300 hover:bg-zinc-700' : 'text-gray-600 hover:bg-gray-200'}`} title="Copiar todo">
                        <Copy size={16} />
                    </button>
                     <button onClick={clearCompleted} className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ml-auto ${isDark ? 'text-red-400 hover:bg-zinc-700' : 'text-red-500 hover:bg-gray-200'}`} title="Borrar completados">
                        <Eraser size={16} />
                    </button>
                </div>

                {/* Editor Area (Overlay Strategy) */}
                <div className="flex-1 relative">
                    {/* Backdrop Layer for Highlighting */}
                    <div 
                        ref={backdropRef}
                        className={`absolute inset-0 p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none select-none overflow-hidden ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}
                    >
                        {renderBackdrop()}
                    </div>

                    {/* Textarea Layer for Editing */}
                    <textarea
                        ref={textareaRef}
                        className={`absolute inset-0 w-full h-full p-6 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-transparent caret-zinc-500 dark:caret-zinc-100 custom-scrollbar z-10 selection:bg-emerald-500/30`}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onScroll={handleScroll}
                        placeholder="Escribe libremente... Usa [ ] para checkboxes, # para títulos..."
                        spellCheck={false}
                    />
                </div>
                
                <div className={`px-4 py-2 text-[10px] text-right ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                   Se guardará al cerrar
                </div>
            </div>
        </div>
    );
};

const CloudSyncModal = ({ isOpen, onClose, currentUserId, isCustom, onSetCustomId, onClearCustomId, isDark, onActivateCloudMode }: any) => {
    const [inputValue, setInputValue] = useState('');
    const [copied, setCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        const textArea = document.createElement("textarea");
        textArea.value = currentUserId;
        document.body.appendChild(textArea);
        textArea.select();
        try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { console.error('Fallback copy failed', err); }
        document.body.removeChild(textArea);
    };

    const handleActivateClick = async () => {
        setIsSharing(true);
        await onActivateCloudMode();
        setIsSharing(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCustom ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 text-zinc-500'}`}>
                            {isCustom ? <Wifi size={20} /> : <WifiOff size={20} />}
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Sincronización Cloud</h3>
                            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                {isCustom ? '● Conectado a Nube' : '○ Modo Local (Privado)'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-200 text-gray-400'}`}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-8">
                    {!isCustom && (
                        <div className={`p-4 rounded-xl border border-dashed ${isDark ? 'bg-zinc-900/50 border-zinc-700' : 'bg-emerald-50/50 border-emerald-200'}`}>
                            <div className="flex items-start gap-3 mb-3">
                                <Globe size={18} className="text-emerald-500 mt-1" />
                                <div>
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>Activar Modo Nube</h4>
                                    <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                        Sube tus datos locales a la nube para acceder desde otros dispositivos usando tu ID.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={handleActivateClick}
                                disabled={isSharing}
                                className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${isSharing ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                            >
                                {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} 
                                {isSharing ? 'Sincronizando...' : 'Activar y Sincronizar Ahora'}
                            </button>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                             <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}><Laptop size={14} /> Tu ID (Para compartir)</label>
                        </div>
                        <div className="flex gap-2">
                            <code className={`flex-1 p-3 rounded-lg text-sm font-mono break-all flex items-center ${isDark ? 'bg-black/50 text-zinc-300 border border-zinc-800' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                                {currentUserId}
                            </code>
                            <button onClick={handleCopy} className={`px-4 rounded-lg font-medium transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] ${copied ? 'bg-emerald-500 text-white' : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}>{copied ? <Check size={18} /> : <Copy size={18} />}<span className="text-[10px]">{copied ? 'Copiado' : 'Copiar'}</span></button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}><Smartphone size={14} /> Conectar a otro ID</label>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Pega un ID remoto aquí..." className={`flex-1 rounded-lg px-4 py-3 text-sm outline-none border transition-all ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-emerald-500 focus:bg-black' : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500'}`} />
                            <button onClick={() => { if(inputValue.trim()) onSetCustomId(inputValue.trim()); }} disabled={!inputValue.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold transition-transform active:scale-95">Conectar</button>
                        </div>
                    </div>
                </div>
                {isCustom && (
                    <div className={`p-4 border-t ${isDark ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'}`}>
                        <button onClick={onClearCustomId} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 font-medium text-sm py-2"><LogOut size={16} /> Desconectar (Volver a Local)</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const workerCode = `self.onmessage = function(e) { if (e.data === 'start') { if (self.timerId) clearInterval(self.timerId); self.timerId = setInterval(function() { postMessage('tick'); }, 1000); } else if (e.data === 'stop') { if (self.timerId) clearInterval(self.timerId); } };`;

const PomodoroTimer = ({ isDark, isSidebarExpanded, onFocusComplete }: any) => {
    const DEFAULT_FOCUS = 52;
    const DEFAULT_BREAK = 17;
    const [timeLeft, setTimeLeft] = useState(DEFAULT_FOCUS * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('focus');
    const [showSettings, setShowSettings] = useState(false);
    const [customFocus, setCustomFocus] = useState(DEFAULT_FOCUS);
    const [customBreak, setCustomBreak] = useState(DEFAULT_BREAK);
    const [selectedSound, setSelectedSound] = useState('bell'); 
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const onFocusCompleteRef = useRef(onFocusComplete);
    const workerRef = useRef<Worker | null>(null);
    const endTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const worker = new Worker(URL.createObjectURL(blob));
        workerRef.current = worker;
        worker.onmessage = (e) => { if (e.data === 'tick') setTimeLeft(prev => prev - 1); };
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        if (isActive) {
            workerRef.current?.postMessage('start');
            if (!endTimeRef.current) endTimeRef.current = Date.now() + timeLeft * 1000;
        } else {
            workerRef.current?.postMessage('stop');
            endTimeRef.current = null;
        }
    }, [isActive]);

    useEffect(() => { if (audioPlayerRef.current) { audioPlayerRef.current.src = ALARM_SOUNDS[selectedSound].url; audioPlayerRef.current.load(); } }, [selectedSound]);

    useEffect(() => { onFocusCompleteRef.current = onFocusComplete; }, [onFocusComplete]);

    useEffect(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        document.title = isActive ? `(${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}) TaskFlow` : "TaskFlow";
        return () => { document.title = "TaskFlow"; };
    }, [timeLeft, isActive]);

    useEffect(() => {
        if (isActive && endTimeRef.current) {
            const now = Date.now();
            const diff = Math.ceil((endTimeRef.current - now) / 1000);
            if (Math.abs(diff - timeLeft) > 1) setTimeLeft(diff > 0 ? diff : 0);
        }
    }, [timeLeft, isActive]);

    useEffect(() => {
        if (timeLeft <= 0 && isActive) {
            setIsActive(false); 
            if (audioPlayerRef.current) { audioPlayerRef.current.volume = 1.0; audioPlayerRef.current.currentTime = 0; audioPlayerRef.current.play().catch(() => {}); }
            if ("Notification" in window && Notification.permission === "granted") try { new Notification("TaskFlow", { body: mode === 'focus' ? "¡Tiempo de enfoque terminado!" : "¡Descanso terminado!", icon: '/favicon.ico' }); } catch (e) {}
            if (mode === 'focus') {
                if (onFocusCompleteRef.current) onFocusCompleteRef.current(customFocus);
                setMode('break');
                setTimeLeft(customBreak * 60);
                setTimeout(() => setIsActive(true), 100); 
            } else {
                setMode('focus');
                setTimeLeft(customFocus * 60);
            }
        }
    }, [timeLeft, isActive, mode, customBreak, customFocus]);

    const toggleTimer = () => {
        if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
        if (timeLeft === 0) { setTimeLeft(mode === 'focus' ? customFocus * 60 : customBreak * 60); setIsActive(true); } else { setIsActive(!isActive); }
    };
    
    const resetTimer = () => {
        if (mode === 'focus' && timeLeft < customFocus * 60) {
            const elapsedSeconds = (customFocus * 60) - timeLeft;
            const minutesLogged = Math.round(elapsedSeconds / 60);
            if (minutesLogged > 0 && onFocusCompleteRef.current) onFocusCompleteRef.current(minutesLogged);
        }
        setIsActive(false); setMode('focus'); setTimeLeft(customFocus * 60);
    };

    const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; };

    const saveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        setShowSettings(false);
        const f = Math.max(1, Number(customFocus));
        const b = Math.max(1, Number(customBreak));
        setCustomFocus(f); setCustomBreak(b);
        if (!isActive) setTimeLeft(mode === 'focus' ? f * 60 : b * 60);
    };

    if (showSettings) return (
        <div className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex justify-between items-center mb-3"><span className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Ajustes</span><button onClick={() => setShowSettings(false)} className={isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-black'}><X size={14}/></button></div>
            <form onSubmit={saveSettings} className="space-y-3">
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Focus (min)</label><input type="number" min="1" value={customFocus} onChange={e => setCustomFocus(Number(e.target.value))} className={`w-full px-2 py-1 rounded text-sm outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`} /></div>
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Descanso (min)</label><input type="number" min="1" value={customBreak} onChange={e => setCustomBreak(Number(e.target.value))} className={`w-full px-2 py-1 rounded text-sm outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`} /></div>
                <div><label className={`block text-[10px] uppercase font-bold mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>Sonido</label><select value={selectedSound} onChange={e => setSelectedSound(e.target.value)} className={`w-full px-2 py-1.5 rounded text-sm outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-black border border-gray-200'}`}>{Object.entries(ALARM_SOUNDS).map(([key, sound]) => (<option key={key} value={key}>{sound.name}</option>))}</select></div>
                <button type="submit" className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Guardar</button>
            </form>
        </div>
    );

    if (!isSidebarExpanded) return (<div className={`mx-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isActive ? 'bg-emerald-500/20 text-emerald-500' : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}`} onClick={toggleTimer} title={isActive ? "Pausar" : "Iniciar"}>{isActive ? <Pause size={16} /> : <Timer size={16} />}</div>);

    return (
        <>
            <div className={`mb-4 p-3 rounded-xl border transition-all ${isActive ? isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50' : isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5">{mode === 'focus' ? <Timer size={14} className={isActive ? 'text-emerald-500' : isDark ? 'text-zinc-500' : 'text-gray-400'} /> : <Coffee size={14} className="text-amber-500" />}<span className={`text-[10px] font-bold uppercase tracking-wide ${mode === 'break' ? 'text-amber-500' : isActive ? 'text-emerald-500' : isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{mode === 'focus' ? 'Focus' : 'Descanso'}</span></div>
                    <button type="button" onClick={() => setShowSettings(true)} className={`p-1 rounded transition-colors ${isDark ? 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}><Settings size={12} /></button>
                </div>
                <div className={`text-2xl font-mono font-bold text-center my-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{formatTime(timeLeft)}</div>
                <div className="flex justify-center gap-2 mt-2">
                    <button onClick={toggleTimer} className={`p-1.5 rounded-lg transition-colors flex-1 flex justify-center ${isActive ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}>{isActive ? <Pause size={16} /> : <Play size={16} />}</button>
                    <button onClick={resetTimer} className={`p-1.5 rounded-lg transition-colors flex-1 flex justify-center ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-gray-400 hover:bg-gray-200 border border-gray-200'}`} title="Detener y guardar"><Square size={16} /></button>
                </div>
            </div>
            <audio ref={audioPlayerRef} preload="auto" src={ALARM_SOUNDS[selectedSound].url} />
        </>
    );
};

const MiniCalendar = ({ isDark, tasks, selectedDate, onSelectDate }: any) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayIndex = new Date(year, month, 1).getDay(); 
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    
    const daysWithTasks = useMemo(() => {
        const daysSet = new Set();
        tasks.forEach((t: Task) => { if (!t.completed && t.dueDate) { const tDate = parseLocalDate(t.dueDate); if (tDate && tDate.getMonth() === month && tDate.getFullYear() === year) { daysSet.add(tDate.getDate()); } } });
        return daysSet;
    }, [tasks, month, year]);

    const handleDateClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (selectedDate === dateStr) {
            onSelectDate(null);
        } else {
            onSelectDate(dateStr);
        }
    };

    const renderDays = () => {
        const days = []; const today = new Date();
        for (let i = 0; i < firstDayIndex; i++) days.push(<div key={`empty-${i}`} className="h-7" />);
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
            const hasTask = daysWithTasks.has(d);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;

            days.push(
                <div key={d} className="h-7 flex flex-col items-center justify-center relative cursor-pointer" onClick={() => handleDateClick(d)}>
                    <div className={`w-7 h-7 flex items-center justify-center text-xs rounded-full z-10 transition-all ${
                        isSelected ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30' :
                        isToday ? 'bg-zinc-200 text-zinc-900 font-bold dark:bg-zinc-700 dark:text-white' : 
                        isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                        {d}
                    </div>
                    {hasTask && !isSelected && <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />}
                </div>
            );
        }
        return days;
    };
    return (
        <div className={`p-4 rounded-2xl border transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-4"><span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span><div className="flex gap-1"><button onClick={prevMonth} className={`p-1 rounded-md ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-400'}`}><ChevronLeft size={14} /></button><button onClick={nextMonth} className={`p-1 rounded-md ${isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-400'}`}><ChevronRight size={14} /></button></div></div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">{daysOfWeek.map(d => <span key={d} className={`text-[10px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1 text-center">{renderDays()}</div>
        </div>
    );
};

const PerformanceChart = ({ isDark, completionRate }: any) => (
    <div className={`p-4 rounded-2xl border mt-4 transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex items-center justify-between mb-3"><span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Rendimiento</span><span className="text-xl font-bold text-emerald-500">{completionRate}%</span></div>
        <div className="h-16 flex items-end gap-1 px-1">{[30, 45, 35, 60, 50, 75, completionRate].map((h, i) => (<div key={i} className="flex-1 bg-transparent rounded-t-sm relative group h-full"><div className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-1000 ${i === 6 ? 'bg-emerald-500' : isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} style={{ height: `${Math.max(h, 5)}%` }} /></div>))}</div>
    </div>
);

const TaskProgressRing = ({ total, completed, isDark, label }: any) => {
    if (!total) return null;
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min((completed / total) * 100, 100);
    const dashoffset = circumference - (progress / 100) * circumference;
    const isFull = completed === total;
    return (
        <div className="relative flex items-center justify-center cursor-help" title={`${completed} de ${total} subtareas completadas`}>
            <svg width="24" height="24" className="transform -rotate-90">
                <circle r={radius} cx="12" cy="12" fill="transparent" stroke="currentColor" strokeWidth="2.5" className={isDark ? "text-zinc-800" : "text-gray-200"} />
                <circle r={radius} cx="12" cy="12" fill="transparent" stroke="currentColor" strokeWidth="2.5" className={isFull ? "text-emerald-500 transition-all duration-500" : "text-blue-500 transition-all duration-500"} strokeDasharray={circumference} strokeDashoffset={dashoffset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[8px] font-bold ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{label}</span>
            </div>
        </div>
    );
};

const TaskItem = ({ task, subtasks, onToggle, onClick, onDelete, isDark, showProjectName, onOpenChecklist }: any) => {
  const overdue = !task.completed && isOverdue(task.dueDate);
  const dueToday = !task.completed && isDueToday(task.dueDate);
  const daysLeft = getDaysRemaining(task.dueDate);
  const priorityStyle = PRIORITIES[task.priority] || PRIORITIES['none'];
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((t: Task) => t.completed).length;
  const daysOpen = getDaysOpen(task.createdAt);
  const daysLabel = `${daysOpen}d`;

  // Parse checklist from rich note content if exists
  const noteContent = task.noteContent || '';
  const totalChecks = (noteContent.match(/\[ \]|\[x\]/g) || []).length;
  const completedChecks = (noteContent.match(/\[x\]/g) || []).length;

  let daysText = "";
  if (task.dueDate && !task.completed) { if (overdue) daysText = `Hace ${Math.abs(daysLeft || 0)}d`; else if (!dueToday) daysText = `${daysLeft}d`; }
  
  return (
    <div onClick={() => onClick(task)} data-task-id={task.id} className={`group flex items-center gap-4 p-4 rounded-xl border mb-3 cursor-pointer transition-all duration-200 ${priorityStyle.border} ${task.completed ? isDark ? 'bg-zinc-900/30 border-zinc-800/50 opacity-50' : 'bg-gray-50 border-gray-100 opacity-60' : isDark ? 'bg-[#18181b] border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-200 hover:border-emerald-200'}`}>
      <div className={`${isDark ? 'text-zinc-600' : 'text-gray-300'} cursor-move opacity-0 group-hover:opacity-50 hover:opacity-100`}><GripVertical size={16} /></div>
      <button onClick={(e) => { e.stopPropagation(); onToggle(task); }} className={`flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : overdue ? 'text-red-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>{task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}</button>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[15px] font-medium transition-all ${task.completed ? isDark ? 'text-zinc-500 line-through' : 'text-gray-400 line-through' : isDark ? 'text-zinc-200' : 'text-gray-700'}`}>{task.title}</span>
            <div className="flex items-center gap-2">
                {task.priority && task.priority !== 'none' && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${priorityStyle.bg} ${priorityStyle.color} border-transparent`}><Flag size={10} className={priorityStyle.iconColor} />{priorityStyle.label}</span>)}
                {task.recurrence && task.recurrence !== 'none' && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'}`} title={`Se repite: ${RECURRENCE_OPTIONS[task.recurrence]?.label}`}><Repeat size={10} /></span>)}
                {showProjectName && (<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{showProjectName}</span>)}
                {task.completed && task.completedAt && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-500/10 text-emerald-500 flex items-center gap-1 border border-emerald-500/20"><Check size={10} />{formatCompletionDate(task.completedAt)}</span>}
                {task.dueDate && !task.completed && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${overdue ? 'bg-red-500/10 text-red-500 border-red-500/20' : dueToday ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : isDark ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{overdue ? 'Vencida' : dueToday ? 'Hoy' : formatDate(task.dueDate)}{daysText && !dueToday && <span className={`opacity-70 border-l pl-1 ml-0.5 ${overdue ? 'border-red-400/30' : isDark ? 'border-zinc-600' : 'border-gray-300'}`}>{daysText}</span>}</span>}
                {totalChecks > 0 && (
                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 border ${isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                       <ClipboardList size={10} /> {completedChecks}/{totalChecks}
                   </span>
                )}
            </div>
        </div>
        {(task.description) && <div className={`flex items-center gap-3 mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}><span className="truncate max-w-[200px]">{task.description}</span></div>}
      </div>
      
      {/* Days Open Counter / Ring */}
      <div className="flex-shrink-0 ml-2">
          {totalChecks > 0 ? (
              <TaskProgressRing total={totalChecks} completed={completedChecks} isDark={isDark} label={daysLabel} />
          ) : (
              <div className={`w-6 h-6 flex items-center justify-center text-[9px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} title={`Tarea abierta hace ${daysOpen} días`}>
                  {daysLabel}
              </div>
          )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
            onClick={(e) => { e.stopPropagation(); onOpenChecklist(task); }} 
            className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-500'}`}
            title="Abrir Notas/Checklist"
        >
            <ClipboardList size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onClick(task); }} className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-700'}`}><Edit2 size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className={`p-2 rounded-lg ${isDark ? 'text-zinc-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={16} /></button>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, isDark, confirmText = "Eliminar", cancelText = "Cancelar" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
      <div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col items-center text-center mb-6"><div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-3"><AlertTriangle size={20} /></div><h3 className={`text-lg font-medium mb-1 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{title}</h3><p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{message}</p></div>
        <div className="flex gap-3"><button onClick={onCancel} className={`flex-1 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{cancelText}</button><button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium">{confirmText}</button></div>
      </div>
    </div>
  );
};

const PomodoroLogModal = ({ isOpen, projects, onSave, onCancel, isDark, minutes }: any) => {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    useEffect(() => { if (projects.length > 0) setSelectedProjectId(projects[0].id); }, [projects]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-3"><Timer size={24} /></div>
                    <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>¡Sesión Registrada!</h3>
                    <p className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Has completado <strong>{minutes} minutos</strong>.<br/>¿A qué proyecto dedicaste este tiempo?</p>
                    <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border outline-none text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-gray-300 text-gray-900'}`}>{projects.map((p: Project) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select>
                </div>
                <div className="flex gap-3"><button onClick={onCancel} className={`flex-1 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>Descartar</button><button onClick={() => onSave(selectedProjectId)} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">Registrar</button></div>
            </div>
        </div>
    );
};

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [customUid, setCustomUid] = useState<string | null>(() => localStorage.getItem('taskflow_custom_uid'));
  const userId = useMemo(() => customUid || authUser?.uid, [customUid, authUser]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState<Project>(HOME_VIEW);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true); 
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null); 
  const [editingTask, setEditingTask] = useState<Task | null>(null); 
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskDate, setEditingSubtaskDate] = useState("");
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null as any, confirmText: 'Eliminar' });
  const [pomodoroLogModalOpen, setPomodoroLogModalOpen] = useState(false);
  const [completedFocusMinutes, setCompletedFocusMinutes] = useState(0);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectLinks, setProjectLinks] = useState([{ name: '', url: '' }]); 
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const importPendingDataRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectNotes, setProjectNotes] = useState('');
  const prevProjectIdRef = useRef<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'created'>('priority');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New State for Checklist Modal (Text Mode)
  const [checklistModalTask, setChecklistModalTask] = useState<Task | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
    };
    initAuth();
    return onAuthStateChanged(auth, setAuthUser);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingTask && detailsPanelRef.current) { if (!detailsPanelRef.current.contains(event.target as Node)) { if (!(event.target as Element).closest('[data-task-id]')) { setEditingTask(null); } } }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingTask]);

  useEffect(() => {
      setSelectedDateFilter(null);
      setSearchQuery('');
  }, [activeProject]);

  // Updated Collection Ref Logic
  const getCollectionRef = (collectionName: string, forceCustomId: string | null = null): CollectionReference => {
      const targetId = forceCustomId || customUid;
      if (targetId) return collection(db, 'artifacts', appId, 'public', 'data', `${collectionName}_${targetId}`);
      return collection(db, 'artifacts', appId, 'users', authUser?.uid || 'anon', collectionName);
  };

  useEffect(() => {
    if (!authUser?.uid && !customUid) return;
    const q = query(getCollectionRef('projects'));
    return onSnapshot(q, (snapshot: any) => {
      const list = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Project));
      list.sort((a: Project, b: Project) => (safeDate(b.createdAt)?.getTime() || 0) - (safeDate(a.createdAt)?.getTime() || 0));
      setProjects(list);
      if (!activeProject || activeProject.id !== HOME_VIEW.id) {
          const exists = list.find((p: Project) => p.id === activeProject?.id);
          if (!exists) setActiveProject(HOME_VIEW);
          else setActiveProject(exists);
      }
    }, (error: any) => { if (!customUid) showNotification('error', 'Error de sincronización (Proyectos)'); });
  }, [authUser?.uid, customUid, activeProject?.id]);

  useEffect(() => {
    if (!authUser?.uid && !customUid) return;
    const q = query(getCollectionRef('tasks'));
    return onSnapshot(q, (snapshot: any) => { setTasks(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task))); }, (error: any) => { console.error("Sync Error Tasks:", error); });
  }, [authUser?.uid, customUid]);

  // Sync Notes Effect
  useEffect(() => {
      if (activeProject && activeProject.id !== HOME_VIEW.id) {
          if (prevProjectIdRef.current !== activeProject.id) {
              setProjectNotes(activeProject.quickNotes || '');
              prevProjectIdRef.current = activeProject.id;
          }
      }
  }, [activeProject]);

  const handleSaveNotes = async () => {
      if (!activeProject || activeProject.id === HOME_VIEW.id || (!userId && !customUid)) return;
      if (projectNotes === (activeProject.quickNotes || '')) return;
      const colRef = getCollectionRef('projects');
      try { await updateDoc(doc(colRef, activeProject.id), { quickNotes: projectNotes }); } 
      catch (error) { console.error("Error saving notes:", error); showNotification('error', 'Error al guardar notas'); }
  };

  const handleSetCustomId = (id: string) => { 
      setCustomUid(id); 
      localStorage.setItem('taskflow_custom_uid', id); 
      setIsCloudSyncModalOpen(false); 
      showNotification('success', 'Conectado a espacio compartido.'); 
      setActiveProject(HOME_VIEW); 
  };
  
  const handleClearCustomId = () => { 
      setCustomUid(null); 
      localStorage.removeItem('taskflow_custom_uid'); 
      setIsCloudSyncModalOpen(false); 
      showNotification('info', 'Desconectado. Regresando a espacio privado.'); 
      setActiveProject(HOME_VIEW); 
  };

  // Activate Cloud Mode: Copy Private -> Public, then set customUid to self
  const handleActivateCloudMode = async () => {
      if (!authUser?.uid) return;
      try {
          // 1. Fetch current private data
          const projectsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', authUser.uid, 'projects'));
          const tasksSnap = await getDocs(collection(db, 'artifacts', appId, 'users', authUser.uid, 'tasks'));
          const targetSuffix = authUser.uid;
          
          const chunks: any[] = []; let currentBatch = writeBatch(db); let count = 0;
          const pushBatch = () => { chunks.push(currentBatch); currentBatch = writeBatch(db); count = 0; };
          
          // 2. Write to Public path
          projectsSnap.docs.forEach((docSnap: any) => { 
              const data = docSnap.data(); 
              const newRef = doc(db, 'artifacts', appId, 'public', 'data', `projects_${targetSuffix}`, docSnap.id); 
              currentBatch.set(newRef, data); 
              count++; if (count >= 450) pushBatch(); 
          });
          tasksSnap.docs.forEach((docSnap: any) => { 
              const data = docSnap.data(); 
              const newRef = doc(db, 'artifacts', appId, 'public', 'data', `tasks_${targetSuffix}`, docSnap.id); 
              currentBatch.set(newRef, data); 
              count++; if (count >= 450) pushBatch(); 
          });
          
          if (count > 0) chunks.push(currentBatch);
          await Promise.all(chunks.map(b => b.commit()));

          // 3. Switch to Cloud Mode locally by setting customUid to own ID
          handleSetCustomId(authUser.uid);
          
          showNotification('success', 'Modo Nube Activado. Tus datos están sincronizados.');
      } catch (error: any) { 
          console.error("Activation error:", error); 
          showNotification('error', 'Error al activar modo nube: ' + error.message); 
      }
  };

  const handleShareData = handleActivateCloudMode; 

  // --- CHECKLIST FUNCTIONS ---
  const handleOpenChecklist = (task: Task) => {
      setChecklistModalTask(task);
  };

  // Update plain text note content
  const handleUpdateNote = async (taskId: string, newNoteContent: string) => {
      const colRef = getCollectionRef('tasks');
      try {
          await updateDoc(doc(colRef, taskId), { noteContent: newNoteContent });
      } catch (error) {
          console.error("Error updating note:", error);
          showNotification('error', 'Error al actualizar nota');
      }
  };

  const activeRootTasks = useMemo(() => {
    if (!activeProject) return [];
    let filteredTasks = [];
    if (activeProject.id === HOME_VIEW.id) filteredTasks = tasks.filter(t => !t.parentTaskId);
    else filteredTasks = tasks.filter(t => t.projectId === activeProject.id && !t.parentTaskId);
    
    if (selectedDateFilter) {
        filteredTasks = filteredTasks.filter(t => t.dueDate === selectedDateFilter);
    }

    if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(t => t.title.toLowerCase().includes(lowerQuery));
    }

    return filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        
        if (sortBy === 'priority') {
            const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
            const scoreA = priorityScore[a.priority || 'none'];
            const scoreB = priorityScore[b.priority || 'none'];
            if (scoreA !== scoreB) return scoreB - scoreA;
            const dateA = new Date(a.dueDate || '9999-12-31');
            const dateB = new Date(b.dueDate || '9999-12-31');
            return dateA.getTime() - dateB.getTime();
        } else if (sortBy === 'date') {
            const dateA = new Date(a.dueDate || '9999-12-31');
            const dateB = new Date(b.dueDate || '9999-12-31');
            if (dateA.getTime() - dateB.getTime() !== 0) return dateA.getTime() - dateB.getTime();
            const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
            const scoreA = priorityScore[a.priority || 'none'];
            const scoreB = priorityScore[b.priority || 'none'];
            return scoreB - scoreA;
        } else if (sortBy === 'created') {
            const timeA = (safeDate(a.createdAt)?.getTime() || 0);
            const timeB = (safeDate(b.createdAt)?.getTime() || 0);
            return timeA - timeB; 
        }
        return 0;
    });
  }, [tasks, activeProject, sortBy, selectedDateFilter, searchQuery]); 

  const currentTaskSubtasks = useMemo(() => { if (!editingTask) return []; return tasks.filter(t => t.parentTaskId === editingTask.id); }, [tasks, editingTask]);
  const pendingTasks = activeRootTasks.filter(t => !t.completed);
  const completedTasks = activeRootTasks.filter(t => t.completed);
  const completionRate = activeRootTasks.length > 0 ? Math.round((activeRootTasks.filter(t=>t.completed).length / activeRootTasks.length) * 100) : 0;

  const getProjectName = (projectId: string) => { const proj = projects.find(p => p.id === projectId); return proj ? proj.name : null; };
  const showNotification = (type: NotificationType['type'], message: string) => setNotification({ type, message });
  const requestDelete = (title: string, message: string, confirmAction: any) => setConfirmModal({ isOpen: true, title, message, confirmText: "Eliminar", onConfirm: async () => { await confirmAction(); setConfirmModal(p => ({ ...p, isOpen: false })); } });
  const handleAddLinkRow = () => { setProjectLinks([...projectLinks, { name: '', url: '' }]); };
  const handleRemoveLinkRow = (index: number) => { const newLinks = [...projectLinks]; newLinks.splice(index, 1); setProjectLinks(newLinks); };
  const handleLinkChange = (index: number, field: 'name' | 'url', value: string) => { const newLinks = [...projectLinks]; newLinks[index][field] = value; setProjectLinks(newLinks); };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || (!userId && !customUid)) return; 
    const validLinks = projectLinks.filter(l => l.url.trim() !== '');
    const colRef = getCollectionRef('projects');
    try {
        if (editingProject) await updateDoc(doc(colRef, editingProject.id), { name: projectName, links: validLinks });
        else { const d = await addDoc(colRef, { name: projectName, links: validLinks, createdAt: serverTimestamp() }); setActiveProject({ id: d.id, name: projectName, links: validLinks }); }
        setIsProjectModalOpen(false); showNotification('success', 'Guardado');
    } catch(e) { showNotification('error', 'Error al guardar'); }
  };

  const handleDeleteProject = (pid: string) => requestDelete('Eliminar Proyecto', 'Se borrará de la base de datos.', async () => {
      const colRefP = getCollectionRef('projects'); const colRefT = getCollectionRef('tasks');
      await deleteDoc(doc(colRefP, pid)); tasks.filter(t => t.projectId === pid).forEach(async t => await deleteDoc(doc(colRefT, t.id)));
      if (activeProject?.id === pid) setActiveProject(HOME_VIEW); showNotification('success', 'Proyecto eliminado');
  });

  const handleQuickAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    let targetProjectId = activeProject.id;
    if (targetProjectId === HOME_VIEW.id) { if (projects.length > 0) targetProjectId = projects[0].id; else { showNotification('error', 'Crea un proyecto primero.'); return; } }
    const initialDate = selectedDateFilter || '';
    await addDoc(getCollectionRef('tasks'), { projectId: targetProjectId, title: quickTaskTitle, description: '', dueDate: initialDate, completed: false, parentTaskId: null, priority: 'medium', recurrence: 'none', noteContent: '', createdAt: serverTimestamp() });
    setQuickTaskTitle('');
  };

  const handleToggleTask = async (task: Task) => {
    const colRef = getCollectionRef('tasks'); const newCompleted = !task.completed;
    try {
        if (newCompleted && task.recurrence && task.recurrence !== 'none') {
            const updatePromise = updateDoc(doc(colRef, task.id), { completed: true, completedAt: serverTimestamp() });
            const nextDate = calculateNextDueDate(task.dueDate, task.recurrence);
            if (nextDate) {
                const newTaskData = { ...task, id: undefined, completed: false, completedAt: null, createdAt: serverTimestamp(), dueDate: nextDate, noteContent: '' }; 
                Object.keys(newTaskData).forEach(key => (newTaskData as any)[key] === undefined && delete (newTaskData as any)[key]);
                await Promise.all([updatePromise, addDoc(colRef, newTaskData)]); showNotification('success', `Tarea recurrente creada para el ${formatDate(nextDate)}`);
            } else { await updatePromise; }
        } else { await updateDoc(doc(colRef, task.id), { completed: newCompleted, completedAt: newCompleted ? serverTimestamp() : null }); }
    } catch (error) { showNotification('error', 'Error al actualizar tarea'); }
  };

  const handleUpdateTaskDetail = async (field: keyof Task, value: any) => { if (!editingTask) return; setEditingTask(p => p ? ({ ...p, [field]: value }) : null); await updateDoc(doc(getCollectionRef('tasks'), editingTask.id), { [field]: value }); };
  const handleAddSubtask = async (e: any) => { e.preventDefault(); const title = e.target.subtaskTitle.value; const date = e.target.subtaskDate.value; if (!title.trim() || !editingTask) return; await addDoc(getCollectionRef('tasks'), { projectId: editingTask.projectId, parentTaskId: editingTask.id, title: title, description: '', dueDate: date, completed: false, createdAt: serverTimestamp() }); e.target.reset(); };
  const saveEditingSubtask = async () => { if (!editingSubtaskId || !editingSubtaskTitle.trim()) return; await updateDoc(doc(getCollectionRef('tasks'), editingSubtaskId), { title: editingSubtaskTitle, dueDate: editingSubtaskDate }); setEditingSubtaskId(null); };
  const handleDeleteTask = (tid: string) => requestDelete('Eliminar Tarea', 'Se borrará permanentemente.', async () => { const colRef = getCollectionRef('tasks'); await deleteDoc(doc(colRef, tid)); if (editingTask?.id === tid) setEditingTask(null); tasks.filter(t => t.parentTaskId === tid).forEach(async s => await deleteDoc(doc(colRef, s.id))); showNotification('success', 'Tarea eliminada'); });
  const handleFocusComplete = useCallback((minutes: number) => { setCompletedFocusMinutes(minutes); setPomodoroLogModalOpen(true); }, []);
  const handleLogPomodoro = async (projectId: string) => { if (!projectId) return; try { await addDoc(getCollectionRef('pomodoro_logs'), { projectId, durationMinutes: completedFocusMinutes, createdAt: serverTimestamp() }); setPomodoroLogModalOpen(false); showNotification('success', 'Sesión registrada'); } catch (error) { console.error("Error logging pomodoro:", error); } };

  const handleExportPomodoroCSV = async () => {
      setIsExportingCSV(true);
      try {
          const logsSnapshot = await getDocs(getCollectionRef('pomodoro_logs'));
          if (logsSnapshot.empty) { showNotification('warning', 'No hay sesiones para exportar.'); setIsExportingCSV(false); return; }
          const logs = logsSnapshot.docs.map((doc: any) => {
              const data = doc.data(); const dateObj = safeDate(data.createdAt);
              return { fecha: dateObj ? dateObj.toLocaleDateString('es-ES') : 'N/A', hora: dateObj ? dateObj.toLocaleTimeString('es-ES') : 'N/A', proyecto: `"${(getProjectName(data.projectId) || 'Desconocido').replace(/"/g, '""')}"`, minutos: data.durationMinutes };
          });
          const headers = ['Fecha', 'Hora', 'Proyecto', 'Minutos'];
          const csvRows = logs.map((row: any) => `${row.fecha},${row.hora},${row.proyecto},${row.minutos}`);
          const csvContent = [headers.join(','), ...csvRows].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `pomodoro_log_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
          showNotification('success', 'Reporte CSV generado');
      } catch (error) { console.error("Export error:", error); showNotification('error', 'Error al generar el reporte'); } finally { setIsExportingCSV(false); }
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
            exportDate: new Date().toISOString(), 
            version: 1 
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; const d = new Date(); const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; a.download = `taskflow_backup_${dateStr}.json`; a.click(); showNotification('success', 'Backup guardado localmente');
      } catch (e) { console.error(e); showNotification('error', 'Error al crear backup'); } finally { setIsBackingUp(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
      reader.onload = (event) => {
          try { const data = JSON.parse(event.target?.result as string); if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) { showNotification('error', 'Formato de archivo inválido'); return; } importPendingDataRef.current = data; setConfirmModal({ isOpen: true, title: 'Restaurar y Sincronizar', message: `Se cargarán ${data.projects.length} proyectos y ${data.tasks.length} tareas al espacio actual (${customUid ? 'Público' : 'Privado'}). ¿Continuar?`, confirmText: 'Restaurar', onConfirm: executeImport }); } catch (err) { showNotification('error', 'Error al leer el archivo JSON'); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
      }; reader.readAsText(file);
  };

  const executeImport = async () => {
      const data = importPendingDataRef.current; if (!data) return; setConfirmModal(prev => ({ ...prev, isOpen: false })); setIsImporting(true);
      try {
          const chunks: any[] = []; let currentBatch = writeBatch(db); let count = 0; const pushBatch = () => { chunks.push(currentBatch); currentBatch = writeBatch(db); count = 0; };
          const projCol = getCollectionRef('projects'); const taskCol = getCollectionRef('tasks'); const logCol = getCollectionRef('pomodoro_logs');
          for (const p of data.projects) { if (!p.id) continue; const ref = doc(projCol, p.id); const created = safeDate(p.createdAt) || new Date(); const links = p.links || (p.link ? [{name: 'Recurso', url: p.link}] : []); const quickNotes = p.quickNotes || ''; currentBatch.set(ref, { name: p.name || 'Sin nombre', links: links, quickNotes: quickNotes, createdAt: created }); count++; if (count >= 450) pushBatch(); }
          for (const t of data.tasks) { if (!t.id || !t.projectId) continue; const ref = doc(taskCol, t.id); const created = safeDate(t.createdAt) || new Date(); const completedAt = safeDate(t.completedAt); const priority = t.priority || 'medium'; const recurrence = t.recurrence || 'none'; const noteContent = t.noteContent || ''; currentBatch.set(ref, { projectId: t.projectId, title: t.title || 'Sin título', description: t.description || '', dueDate: t.dueDate || '', completed: !!t.completed, parentTaskId: t.parentTaskId || null, priority: priority, recurrence: recurrence, noteContent: noteContent, createdAt: created, completedAt: completedAt }); count++; if (count >= 450) pushBatch(); }
          if (data.pomodoro_logs && Array.isArray(data.pomodoro_logs)) { for (const l of data.pomodoro_logs) { const logId = l.id || doc(logCol).id; const ref = doc(logCol, logId); const created = safeDate(l.createdAt) || new Date(); currentBatch.set(ref, { projectId: l.projectId, durationMinutes: l.durationMinutes, createdAt: created }); count++; if (count >= 450) pushBatch(); } }
          if (count > 0) chunks.push(currentBatch); await Promise.all(chunks.map(b => b.commit())); showNotification('success', 'Restauración completa'); importPendingDataRef.current = null;
      } catch (err: any) { console.error("Import failed:", err); showNotification('error', `Error al importar: ${err.message}`); } finally { setIsImporting(false); }
  };

  return (
    <div className={`flex h-screen w-full font-sans overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#09090b] text-zinc-100' : 'bg-gray-50 text-gray-900'}`}>
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />
      <div className={`border-r flex flex-col z-20 transition-all duration-300 ease-in-out ${isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-gray-200'} ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        <div className="p-4">
          <div className={`flex items-center mb-6 ${isSidebarExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/20"><Layout size={18} className="text-white" /></div>
                 {isSidebarExpanded && <h1 className="font-semibold text-sm tracking-tight animate-in fade-in duration-200">TaskFlow</h1>}
              </div>
              <button onClick={() => setIsDark(!isDark)} className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}>
                  {isDark ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                 {isSidebarExpanded ? <SidebarClose size={16} /> : <SidebarOpen size={16} />}
              </button>
          </div>
          <PomodoroTimer isDark={isDark} isSidebarExpanded={isSidebarExpanded} onFocusComplete={handleFocusComplete} />
          <button onClick={() => { setEditingProject(null); setProjectName(''); setProjectLinks([{ name: '', url: '' }]); setIsProjectModalOpen(true); }} className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all mb-2 ${isSidebarExpanded ? 'w-full px-3' : 'w-10 h-10 px-0 mx-auto'} ${isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm'}`} title="Nuevo Proyecto"><Plus size={18} /> {isSidebarExpanded && <span>Nuevo Proyecto</span>}</button>
          <div onClick={() => setActiveProject(HOME_VIEW)} className={`group flex items-center gap-2 rounded-md cursor-pointer transition-all border ${isSidebarExpanded ? 'p-2' : 'p-2 justify-center w-10 h-10 mx-auto'} ${activeProject?.id === HOME_VIEW.id ? isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50'}`}><Home size={18} className={activeProject?.id === HOME_VIEW.id ? 'text-emerald-500' : ''} />{isSidebarExpanded && <span className="text-sm font-medium">Inicio</span>}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
          {isSidebarExpanded && (<div className="flex items-center justify-between px-2 mb-2 mt-2 cursor-pointer" onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}><h2 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Proyectos</h2><button className={`p-1 rounded hover:bg-zinc-800/50 transition-colors ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{isProjectsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button></div>)}
          {(isSidebarExpanded ? isProjectsExpanded : true) && (<div className={isSidebarExpanded ? "animate-in slide-in-from-top-2 duration-200" : "flex flex-col gap-1 items-center"}>{projects.map(p => (<div key={p.id} onClick={() => setActiveProject(p)} className={`group flex items-center rounded-md cursor-pointer transition-all border ${isSidebarExpanded ? 'justify-between p-2 mb-1' : 'justify-center p-2 w-10 h-10 mb-1'} ${activeProject?.id === p.id ? isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-emerald-50 border-emerald-100 text-emerald-900' : isDark ? 'border-transparent text-zinc-400 hover:bg-zinc-900' : 'border-transparent text-gray-500 hover:bg-gray-100'}`} title={!isSidebarExpanded ? p.name : ''}><div className={`flex items-center gap-2 overflow-hidden ${!isSidebarExpanded && 'justify-center'}`}><FolderOpen size={16} className={activeProject?.id === p.id ? 'text-emerald-500' : isDark ? 'text-zinc-600' : 'text-gray-400'} />{isSidebarExpanded && <span className="text-xs font-medium truncate">{p.name}</span>}</div>{isSidebarExpanded && (<div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={(e) => { e.stopPropagation(); setEditingProject(p); setProjectName(p.name); setProjectLinks(p.links || (p.link ? [{name: 'Recurso', url: p.link}] : [{name:'', url:''}])); setIsProjectModalOpen(true); }} className="hover:text-emerald-500"><Edit2 size={10}/></button><button onClick={(e) => {e.stopPropagation(); handleDeleteProject(p.id);}} className="hover:text-red-500"><Trash2 size={10}/></button></div>)}</div>))}</div>)}
        </div>
        <div className={`p-4 border-t flex gap-2 justify-center ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
             <button onClick={() => setIsCloudSyncModalOpen(true)} className={`flex items-center justify-center p-2 rounded-lg transition-all ${isDark ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title="Sincronización Nube"><CloudCog size={18} /></button>
             {isImporting ? (<div className="flex justify-center py-1"><Loader2 size={18} className="animate-spin text-emerald-500" /></div>) : (
                 <div className="flex gap-2">
                    <button onClick={handleExportPomodoroCSV} disabled={isExportingCSV} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Reporte CSV Pomodoros">{isExportingCSV ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}</button>
                    <button onClick={handleExportData} disabled={isBackingUp} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Descargar Backup Local">{isBackingUp ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}</button>
                    <label className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${isDark ? 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'}`} title="Restaurar Backup"><Upload size={18} /><input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileSelect} /></label>
                 </div>
             )}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden relative h-screen">
        {activeProject ? (
            <div className="flex-1 grid grid-cols-12 gap-0 h-full relative">
                <div className={`hidden lg:flex lg:col-span-4 p-8 border-r flex-col overflow-y-auto custom-scrollbar relative group ${isDark ? 'border-zinc-800' : 'border-gray-200 bg-white/50'}`}>
                    <div className="mb-8">
                        <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{activeProject.name}</h1>
                        {activeProject.links && activeProject.links.length > 0 ? (<div className="flex flex-wrap gap-2 mt-2">{activeProject.links.map((link, idx) => (<a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors py-1.5 px-3 rounded-lg border ${isDark ? 'border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800' : 'border-gray-200 bg-white text-emerald-600 hover:bg-gray-50'}`}><ExternalLink size={12} /> {link.name || 'Recurso'}</a>))}</div>) : activeProject.link ? (<a href={activeProject.link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-sm font-medium transition-colors py-1 px-2 -ml-2 rounded-lg ${isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'}`}><ExternalLink size={16} /> Abrir Recurso</a>) : (<p className={`text-sm italic ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Sin recursos adjuntos.</p>)}
                    </div>
                    <MiniCalendar isDark={isDark} tasks={activeRootTasks} selectedDate={selectedDateFilter} onSelectDate={setSelectedDateFilter} />
                    <PerformanceChart isDark={isDark} completionRate={completionRate} />
                    <div className={`mt-6 p-4 rounded-2xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200 shadow-sm'}`}><h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Progreso General</h3><div className="flex items-end gap-2 mb-2"><span className="text-3xl font-bold text-emerald-500">{activeRootTasks.filter(t=>t.completed).length}</span><span className={`text-sm mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>/ {activeRootTasks.length} tareas</span></div><div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${completionRate}%` }} /></div></div>
                    {/* NOTAS RAPIDAS */}
                    {activeProject.id !== HOME_VIEW.id && (
                        <div className={`mt-6 p-4 rounded-2xl border flex flex-col flex-1 min-h-[150px] transition-colors duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800 focus-within:border-emerald-500/50' : 'bg-white border-gray-200 shadow-sm focus-within:border-emerald-400'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <StickyNote size={14} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Notas Rápidas</h3>
                            </div>
                            <textarea 
                                className={`flex-1 w-full bg-transparent resize-none outline-none text-sm leading-relaxed custom-scrollbar ${isDark ? 'text-zinc-300 placeholder-zinc-700' : 'text-gray-700 placeholder-gray-300'}`}
                                placeholder="Escribe ideas, recordatorios o borradores aquí..."
                                value={projectNotes}
                                onChange={(e) => setProjectNotes(e.target.value)}
                                onBlur={handleSaveNotes}
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>
                <div className="col-span-12 lg:col-span-8 p-8 overflow-y-auto custom-scrollbar relative transition-all duration-300">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                                    {selectedDateFilter ? `Tareas del ${formatDate(selectedDateFilter)}` : 'Tareas'}
                                </h2>
                                <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>{new Date().toLocaleDateString('es-ES', {weekday: 'long', day: 'numeric', month: 'long'})}</span>
                            </div>
                            {/* SORT SWITCH */}
                            <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                                <button 
                                    onClick={() => setSortBy('priority')}
                                    className={`p-1.5 rounded-md transition-all ${sortBy === 'priority' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                                    title="Por Prioridad"
                                >
                                    <Flag size={14} />
                                </button>
                                <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                <button 
                                    onClick={() => setSortBy('date')}
                                    className={`p-1.5 rounded-md transition-all ${sortBy === 'date' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                                    title="Por Fecha de Vencimiento"
                                >
                                    <CalendarDays size={14} />
                                </button>
                                <div className={`w-px h-3 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`} />
                                <button 
                                    onClick={() => setSortBy('created')}
                                    className={`p-1.5 rounded-md transition-all ${sortBy === 'created' ? (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-800') : (isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600')}`}
                                    title="Por Tiempo Abierta (Antigüedad)"
                                >
                                    <Clock size={14} />
                                </button>
                            </div>
                            {selectedDateFilter && (
                                <button onClick={() => setSelectedDateFilter(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold hover:bg-emerald-500/20 transition-colors animate-in fade-in slide-in-from-left-2">
                                    <FilterX size={14} /> Limpiar Filtro
                                </button>
                            )}
                        </div>
                        {/* SEARCH BAR ADDED HERE */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all focus-within:border-emerald-500 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                            <Search size={16} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar tarea..."
                                className={`bg-transparent border-none outline-none text-sm w-32 sm:w-48 ${isDark ? 'text-zinc-200 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    {activeProject.id !== HOME_VIEW.id && (<form onSubmit={handleQuickAddTask} className="mb-8"><div className={`flex items-center gap-3 p-4 rounded-xl border border-dashed transition-all cursor-text ${isDark ? 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/30' : 'bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/10'}`} onClick={() => document.getElementById('quickInput')?.focus()}><Plus size={20} className={isDark ? 'text-zinc-600' : 'text-gray-400'} /><input id="quickInput" type="text" value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} className={`bg-transparent border-none outline-none w-full text-[15px] ${isDark ? 'text-zinc-300 placeholder-zinc-600' : 'text-gray-700 placeholder-gray-400'}`} placeholder="Añadir una nueva tarea..." autoComplete="off" /></div></form>)}
                    <div className="space-y-1">
                        {pendingTasks.length > 0 && (<div className="mb-8"><h3 className={`text-xs font-bold uppercase tracking-wider mb-4 px-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Pendiente - {pendingTasks.length}</h3>{pendingTasks.map(task => (<TaskItem key={task.id} task={task} subtasks={tasks.filter(t => t.parentTaskId === task.id)} onToggle={handleToggleTask} onClick={setEditingTask} onDelete={handleDeleteTask} isDark={isDark} showProjectName={activeProject.id === HOME_VIEW.id ? getProjectName(task.projectId) : null} onOpenChecklist={handleOpenChecklist} />))}</div>)}
                        {completedTasks.length > 0 && (<div><h3 className={`text-xs font-bold uppercase tracking-wider mb-4 px-1 pt-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Completado - {completedTasks.length}</h3>{completedTasks.map(task => (<TaskItem key={task.id} task={task} subtasks={tasks.filter(t => t.parentTaskId === task.id)} onToggle={handleToggleTask} onClick={setEditingTask} onDelete={handleDeleteTask} isDark={isDark} showProjectName={activeProject.id === HOME_VIEW.id ? getProjectName(task.projectId) : null} onOpenChecklist={handleOpenChecklist} />))}</div>)}
                        {activeRootTasks.length === 0 && (<div className={`text-center py-20 flex flex-col items-center ${isDark ? 'text-zinc-700' : 'text-gray-300'}`}><div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}><BarChart3 size={24} /></div><p className="text-sm">
                            {searchQuery ? 'No se encontraron tareas.' : selectedDateFilter ? 'No hay tareas para esta fecha.' : 'No hay tareas aún.'}
                        </p></div>)}
                    </div>
                </div>
            </div>
        ) : (
            <div className={`flex-1 flex flex-col items-center justify-center ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}><div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${isDark ? 'bg-zinc-900 shadow-black/20' : 'bg-white shadow-gray-200'}`}><FolderOpen size={32} className="opacity-50" /></div><h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-800'}`}>Bienvenido a TaskFlow</h2><p>Selecciona un proyecto del menú lateral</p></div>
        )}
        <div ref={detailsPanelRef} className={`fixed inset-y-0 right-0 w-[400px] border-l shadow-2xl transform transition-transform duration-300 z-30 flex flex-col ${editingTask ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}>
          {editingTask && (
            <><div className={`p-5 border-b flex items-center justify-between ${isDark ? 'border-zinc-800' : 'border-gray-100'}`}><span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Detalles</span><button onClick={() => setEditingTask(null)} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-400'}`}><X size={18} /></button></div><div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><div className="flex items-start gap-3 mb-6"><button onClick={() => handleToggleTask(editingTask)} className={`mt-1 flex-shrink-0 ${editingTask.completed ? 'text-emerald-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>{editingTask.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}</button><textarea value={editingTask.title} onChange={(e) => handleUpdateTaskDetail('title', e.target.value)} className={`w-full bg-transparent text-xl font-semibold border-none outline-none resize-none h-auto min-h-[3rem] p-0 leading-tight ${isDark ? 'text-zinc-100 placeholder-zinc-600' : 'text-gray-800 placeholder-gray-400'}`} rows={2} placeholder="Título de la tarea" /></div><div className="mb-6"><label className={`text-[10px] font-bold uppercase mb-2 block ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Prioridad</label><div className="flex gap-2">{['low', 'medium', 'high'].map((level) => { const p = PRIORITIES[level]; const isSelected = editingTask.priority === level; return (<button key={level} onClick={() => handleUpdateTaskDetail('priority', level)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${isSelected ? `${p.bg} ${p.color} ${p.border.replace('border-l-4', 'border')}` : `border-transparent ${isDark ? 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}`}><Flag size={12} className={isSelected ? p.iconColor : 'fill-transparent'} /> {p.label}</button>); })}</div></div><div className="grid grid-cols-2 gap-4 mb-8"><div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}><label className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}><CalendarDays size={10} /> Vencimiento</label><input type="date" value={editingTask.dueDate} onChange={(e) => handleUpdateTaskDetail('dueDate', e.target.value)} className={`bg-transparent text-sm w-full outline-none ${isDark ? 'text-zinc-300 [color-scheme:dark]' : 'text-gray-700 [color-scheme:light]'}`} /></div><div className={`p-3 rounded-lg border ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-gray-50 border-gray-100'}`}><label className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}><Repeat size={10} /> Repetir</label><select value={editingTask.recurrence || ''} onChange={(e) => handleUpdateTaskDetail('recurrence', e.target.value)} className={`bg-transparent text-sm w-full outline-none appearance-none ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{Object.entries(RECURRENCE_OPTIONS).map(([key, opt]) => (<option key={key} value={opt.value} className={isDark ? 'bg-zinc-900' : 'bg-white'}>{opt.label}</option>))}</select></div></div><div className="mb-8"><label className={`text-[10px] font-bold uppercase mb-2 block ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Notas</label><textarea value={editingTask.description} onChange={(e) => handleUpdateTaskDetail('description', e.target.value)} className={`w-full rounded-lg p-3 outline-none border transition-colors min-h-[100px] text-sm resize-none ${isDark ? 'bg-zinc-900/50 border-zinc-800/50 text-zinc-300 placeholder-zinc-600 focus:border-emerald-500/50' : 'bg-gray-50 border-gray-100 text-gray-700 placeholder-gray-400 focus:border-emerald-400'}`} placeholder="Añadir descripción..." /></div><div><div className="flex items-center justify-between mb-3"><label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Subtareas</label><span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'}`}>{currentTaskSubtasks.length}</span></div><div className="space-y-1 mb-3">{currentTaskSubtasks.map((sub: Task) => (<div key={sub.id} className={`group flex items-center gap-2 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50'}`}><button onClick={() => handleToggleTask(sub)} className={`${sub.completed ? 'text-emerald-500' : isDark ? 'text-zinc-600 hover:text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}>{sub.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button><div className="flex-1 min-w-0">{editingSubtaskId === sub.id ? (<div className="flex flex-col gap-2 p-1"><input autoFocus className={`text-sm px-2 py-1.5 rounded border outline-none w-full ${isDark ? 'bg-zinc-900 text-zinc-200 border-emerald-500/50' : 'bg-white text-gray-800 border-emerald-400'}`} value={editingSubtaskTitle} onChange={(e) => setEditingSubtaskTitle(e.target.value)} /><div className="flex gap-2"><input type="date" className={`text-xs px-2 py-1 rounded border outline-none flex-1 ${isDark ? 'bg-zinc-900 text-zinc-400 border-zinc-700 [color-scheme:dark]' : 'bg-white text-gray-500 border-gray-200 [color-scheme:light]'}`} value={editingSubtaskDate} onChange={(e) => setEditingSubtaskDate(e.target.value)} /><button onClick={saveEditingSubtask} className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded"><Check size={14} /></button></div></div>) : (<div className="flex flex-col"><span className={`text-sm ${sub.completed ? isDark ? 'text-zinc-600 line-through' : 'text-gray-400 line-through' : isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{sub.title}</span><div className="flex items-center gap-2 mt-0.5">{sub.completed && sub.completedAt ? (<span className="text-[10px] flex items-center gap-1 text-emerald-500"><Check size={10} />{formatCompletionDate(sub.completedAt)}</span>) : sub.dueDate && (<span className={`text-[10px] flex items-center gap-1 ${isOverdue(sub.dueDate) ? 'text-red-400' : isDark ? 'text-zinc-500' : 'text-gray-400'}`}><Clock size={10} />{formatDate(sub.dueDate)}</span>)}</div></div>)}</div><div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 self-start mt-0.5">{editingSubtaskId !== sub.id && <button onClick={() => {setEditingSubtaskId(sub.id); setEditingSubtaskTitle(sub.title); setEditingSubtaskDate(sub.dueDate||"")}} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}><Edit2 size={12} /></button>}<button onClick={() => handleDeleteTask(sub.id)} className={`p-1.5 rounded ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}><Trash2 size={12} /></button></div></div>))}</div><form onSubmit={handleAddSubtask} className={`flex items-center gap-2 text-sm pl-2 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}><Plus size={16} /><input name="subtaskTitle" placeholder="Añadir paso..." className={`bg-transparent outline-none flex-1 py-2 ${isDark ? 'placeholder-zinc-600 text-zinc-300' : 'placeholder-gray-400 text-gray-700'}`} autoComplete="off" /><input name="subtaskDate" type="date" className={`bg-transparent text-xs outline-none w-24 ${isDark ? 'text-zinc-500 [color-scheme:dark]' : 'text-gray-400 [color-scheme:light]'}`} /></form></div></div><div className={`p-4 border-t flex justify-between items-center text-xs ${isDark ? 'border-zinc-800 bg-[#18181b]' : 'border-gray-100 bg-white'}`}><span className={isDark ? 'text-zinc-600' : 'text-gray-400'}>Creado el {formatCreationDate(editingTask.createdAt)}</span><button onClick={() => handleDeleteTask(editingTask.id)} className="text-red-400 hover:text-red-300 flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={14} /> Eliminar</button></div></>
          )}
        </div>
      </div>
      <TaskNoteModal 
          isOpen={!!checklistModalTask} 
          onClose={() => setChecklistModalTask(null)} 
          task={checklistModalTask} 
          onUpdateNote={handleUpdateNote}
          isDark={isDark}
      />
      {isProjectModalOpen && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className={`w-full max-w-sm rounded-xl border shadow-2xl p-6 animate-in zoom-in-95 ${isDark ? 'bg-[#18181b] border-zinc-800' : 'bg-white border-gray-200'}`}><div className="flex justify-between items-center mb-5"><h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>{editingProject ? 'Editar' : 'Nuevo'} Proyecto</h3><button onClick={() => setIsProjectModalOpen(false)} className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}><X size={20}/></button></div><form onSubmit={handleSaveProject}><div className="space-y-4"><input autoFocus placeholder="Nombre del proyecto" value={projectName} onChange={e => setProjectName(e.target.value)} className={`w-full rounded-lg px-4 py-2.5 outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600 placeholder-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400 placeholder-gray-400'}`} /><div><div className="flex items-center justify-between mb-2"><label className={`text-[10px] font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Recursos</label><button type="button" onClick={handleAddLinkRow} className={`text-xs flex items-center gap-1 ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}><Plus size={12} /> Añadir Link</button></div><div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">{projectLinks.map((link, index) => (<div key={index} className="flex gap-2 items-center"><input type="text" placeholder="Nombre (ej: Figma)" value={link.name} onChange={(e) => handleLinkChange(index, 'name', e.target.value)} className={`w-1/3 rounded-lg px-3 py-2 text-xs outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400'}`} /><input type="url" placeholder="URL (https://...)" value={link.url} onChange={(e) => handleLinkChange(index, 'url', e.target.value)} className={`flex-1 rounded-lg px-3 py-2 text-xs outline-none border transition-colors ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-600' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400'}`} />{projectLinks.length > 1 && (<button type="button" onClick={() => handleRemoveLinkRow(index)} className={`p-1.5 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors`}><Minus size={14} /></button>)}</div>))}</div></div></div><button type="submit" className={`w-full mt-6 font-semibold py-2.5 rounded-lg transition-colors ${isDark ? 'bg-zinc-100 hover:bg-white text-black' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>Guardar</button></form></div></div>)}
      <PomodoroLogModal isOpen={pomodoroLogModalOpen} projects={projects} onSave={handleLogPomodoro} onCancel={() => setPomodoroLogModalOpen(false)} isDark={isDark} minutes={completedFocusMinutes} />
      <CloudSyncModal isOpen={isCloudSyncModalOpen} onClose={() => setIsCloudSyncModalOpen(false)} currentUserId={userId} isCustom={!!customUid} onSetCustomId={handleSetCustomId} onClearCustomId={handleClearCustomId} isDark={isDark} onActivateCloudMode={handleActivateCloudMode} />
      <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(p => ({ ...p, isOpen: false }))} isDark={isDark} />
    </div>
  );
}