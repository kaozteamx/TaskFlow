import { useState, useEffect } from 'react';
import { onSnapshot, query } from '../firebase-setup';
import { PomodoroLog } from '../types';

export const useDashboard = (userId: string | null | undefined, getCollectionRef: (name: string) => any) => {
    const [pomodoroLogs, setPomodoroLogs] = useState<PomodoroLog[]>([]);

    useEffect(() => {
        if (!userId && !window.location.search.includes('demo')) {
            return;
        }

        const q = query(getCollectionRef('pomodoro_logs'));
        const unsub = onSnapshot(q, (snap: any) => {
            const logs: PomodoroLog[] = snap.docs ? snap.docs.map((d: any) => ({
                id: d.id,
                ...d.data()
            })) : [];
            setPomodoroLogs(logs);
        }, (error: any) => {
             console.error("Firestore Error in useDashboard:", error);
        });

        return () => unsub();
    }, [userId, getCollectionRef]);

    return { pomodoroLogs };
};
