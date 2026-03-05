import { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, onAuthStateChanged, signInWithGoogle, signOut, db, IS_DEMO, __app_id, collection } from '../firebase-setup';
import { NotificationType } from '../types';

export const useAuth = (setNotification: (n: NotificationType) => void) => {
    const [authUser, setAuthUser] = useState<any>(null);
    const [customUid, setCustomUid] = useState<string | null>(() => localStorage.getItem('taskflow_custom_uid'));
    const [authLoading, setAuthLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u: any) => {
            setAuthUser(u);
            setAuthLoading(false);
            if (u) setIsLoggingIn(false);
        });
        return unsubscribe;
    }, []);

    const userId = useMemo(() => customUid || authUser?.uid, [customUid, authUser]);

    const getCollectionRef = useCallback((collectionName: string) => {
        if (customUid) {
            return collection(db, 'artifacts', __app_id, 'public', 'data', `${collectionName}_${customUid}`);
        }
        if (!authUser?.uid) return collection(db, collectionName);
        return collection(db, 'artifacts', __app_id, 'users', authUser.uid, collectionName);
    }, [customUid, authUser?.uid]);

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

    const handleSignOut = async () => {
        if (IS_DEMO) localStorage.removeItem('taskflow_force_offline');
        try {
            await signOut();
            setAuthUser(null);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return {
        authUser,
        customUid,
        setCustomUid,
        authLoading,
        isLoggingIn,
        userId,
        getCollectionRef,
        handleLogin,
        handleSignOut
    };
};
