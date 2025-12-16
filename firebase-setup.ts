// @ts-ignore
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken as fbSignInWithCustomToken, 
  signInAnonymously as fbSignInAnonymously, 
  onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut
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
} from 'firebase/firestore';

// --- Globals via Window (injected in index.html) ---
declare const window: any;
const __firebase_config = window.__firebase_config;
export const __app_id = window.__app_id || 'taskflow-app';

// --- Safe Configuration Parsing ---
let firebaseConfig: any = null;
let isDemoMode = true;

try {
    if (__firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
        // Check if it's a real config or a placeholder
        if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "demo-key" && firebaseConfig.projectId && firebaseConfig.projectId !== "demo-project") {
            isDemoMode = false;
        }
    }
} catch (e) {
    console.warn("Error parsing Firebase config, falling back to Demo Mode", e);
    isDemoMode = true;
}

export const IS_DEMO = isDemoMode;

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
        cb(auth.currentUser || { uid: 'demo-user', isAnonymous: true }); // Auto-login in demo
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
let signInWithGoogle: any, signOut: any;
let collection: any, addDoc: any, updateDoc: any, deleteDoc: any, doc: any, onSnapshot: any, query: any, serverTimestamp: any, writeBatch: any, getDocs: any;

if (!IS_DEMO && firebaseConfig) {
    try {
        console.log("TaskFlow: Initializing Real Firebase...");
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        signInAnonymously = fbSignInAnonymously;
        signInWithCustomToken = fbSignInWithCustomToken;
        onAuthStateChanged = fbOnAuthStateChanged;
        
        signInWithGoogle = async () => {
            const provider = new GoogleAuthProvider();
            return signInWithPopup(auth, provider);
        };
        signOut = () => fbSignOut(auth);

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
    } catch (e) {
        console.error("Firebase Init Failed, falling back to mock", e);
        // Fallback logic
        auth = { currentUser: null };
        db = { type: 'mock_db' };
        signInAnonymously = mockAuthImpl.signInAnonymously;
        signInWithCustomToken = mockAuthImpl.signInWithCustomToken;
        onAuthStateChanged = mockAuthImpl.onAuthStateChanged;
        
        signInWithGoogle = async () => {
            const user = { uid: 'demo-google-user', displayName: 'Demo User', photoURL: 'https://ui-avatars.com/api/?name=Demo+User' };
            auth.currentUser = user;
            window.dispatchEvent(new Event('taskflow_auth_change'));
            return { user };
        };
        signOut = async () => {
            auth.currentUser = null;
            window.dispatchEvent(new Event('taskflow_auth_change'));
        };

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
} else {
    console.log("TaskFlow: Demo Mode Active (LocalStorage)");
    auth = { currentUser: null };
    db = { type: 'mock_db' };
    signInAnonymously = mockAuthImpl.signInAnonymously;
    signInWithCustomToken = mockAuthImpl.signInWithCustomToken;
    onAuthStateChanged = mockAuthImpl.onAuthStateChanged;
    
    signInWithGoogle = async () => {
        const user = { uid: 'demo-google-user', displayName: 'Demo User', photoURL: 'https://ui-avatars.com/api/?name=Demo+User' };
        auth.currentUser = user;
        window.dispatchEvent(new Event('taskflow_auth_change'));
        return { user };
    };
    signOut = async () => {
        auth.currentUser = null;
        window.dispatchEvent(new Event('taskflow_auth_change'));
    };

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

export { 
    auth, db, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signInWithGoogle, signOut,
    collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, writeBatch, getDocs 
};
