import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveTaskStatus } from '../services/farmStore';

export function useTaskStatus(farmerId: string) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    setCompleted({});
    if (!db || !farmerId) return;
    return onSnapshot(collection(db, 'farmers', farmerId, 'tasks'), (snap) => {
      setCompleted(Object.fromEntries(snap.docs.map((item) => [item.id, Boolean(item.data().completed)])));
    }, (error) => setError(error.message));
  }, [farmerId]);
  async function toggle(id: string, defaultCompleted = false) {
    try { await saveTaskStatus(farmerId, id, !(completed[id] ?? defaultCompleted)); setError(''); }
    catch (error) { setError((error as Error).message); }
  }
  return { completed, toggle, error };
}
