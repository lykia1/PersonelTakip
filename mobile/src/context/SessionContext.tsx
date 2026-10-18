import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Session = { token: string; user: { name: string; role: string } };
type SavedSession = { session: Session; baseUrl: string };
type Context = {
  session?: Session;
  baseUrl: string;
  ready: boolean;
  storageError?: string;
  setBaseUrl: (value: string) => void;
  saveSession: (session: Session) => Promise<void>;
  clearSession: () => Promise<void>;
};
const SessionContext = createContext<Context | undefined>(undefined);
const key = 'atolye-ekip-session-v1';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>();
  const [baseUrl, setBaseUrl] = useState(process.env.EXPO_PUBLIC_API_URL || '');
  const [ready, setReady] = useState(false);
  const [storageError,setStorageError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const raw = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(key);
        if (raw) {
          const saved: SavedSession = JSON.parse(raw);
          if (!/^[a-f0-9]{64}$/.test(saved.session?.token || '') || typeof saved.baseUrl !== 'string' || !['employee','admin'].includes(saved.session?.user?.role)) {
            await SecureStore.deleteItemAsync(key);
          } else if (!cancelled) {
            setSession(saved.session); setBaseUrl(saved.baseUrl);
          }
        }
      } catch { if (!cancelled) setStorageError('Kayıtlı oturum okunamadı. Yeniden giriş yapabilirsin.'); }
      finally { if (!cancelled) setReady(true); }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);
  async function saveSession(value: Session) {
    const saved: SavedSession = { session: value, baseUrl: baseUrl.trim().replace(/\/$/, '') };
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(key, JSON.stringify(saved), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    setSession(value); setBaseUrl(saved.baseUrl);setStorageError(undefined);
  }
  async function clearSession() {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(key);
    setSession(undefined);
  }
  return <SessionContext.Provider value={{ session, baseUrl, ready, storageError, setBaseUrl, saveSession, clearSession }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
