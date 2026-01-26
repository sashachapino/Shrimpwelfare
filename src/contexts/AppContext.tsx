import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Client } from '../types';
import { hasExistingData, initializeWithPassword, verifyPassword, loadClients, saveClients } from '../utils/storage';

interface AppContextType {
  isUnlocked: boolean;
  hasData: boolean;
  clients: Client[];
  password: string | null;
  loading: boolean;
  error: string | null;
  unlock: (password: string) => Promise<boolean>;
  initialize: (password: string) => Promise<void>;
  lock: () => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Client | undefined;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkExistingData();
  }, []);

  async function checkExistingData() {
    try {
      const exists = await hasExistingData();
      setHasData(exists);
    } catch (err) {
      setError('Failed to check for existing data');
    } finally {
      setLoading(false);
    }
  }

  const unlock = useCallback(async (pwd: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const valid = await verifyPassword(pwd);
      if (!valid) {
        setError('Incorrect password');
        return false;
      }
      const data = await loadClients(pwd);
      setClients(data);
      setPassword(pwd);
      setIsUnlocked(true);
      return true;
    } catch (err) {
      setError('Failed to unlock. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async (pwd: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await initializeWithPassword(pwd);
      setPassword(pwd);
      setClients([]);
      setHasData(true);
      setIsUnlocked(true);
    } catch (err) {
      setError('Failed to initialize. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setPassword(null);
    setClients([]);
  }, []);

  const addClient = useCallback(async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!password) return;

    const now = new Date().toISOString();
    const newClient: Client = {
      ...clientData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...clients, newClient];
    await saveClients(updated, password);
    setClients(updated);
  }, [clients, password]);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
    if (!password) return;

    const updated = clients.map(client =>
      client.id === id
        ? { ...client, ...updates, updatedAt: new Date().toISOString() }
        : client
    );
    await saveClients(updated, password);
    setClients(updated);
  }, [clients, password]);

  const deleteClient = useCallback(async (id: string) => {
    if (!password) return;

    const updated = clients.filter(client => client.id !== id);
    await saveClients(updated, password);
    setClients(updated);
  }, [clients, password]);

  const getClient = useCallback((id: string) => {
    return clients.find(client => client.id === id);
  }, [clients]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        isUnlocked,
        hasData,
        clients,
        password,
        loading,
        error,
        unlock,
        initialize,
        lock,
        addClient,
        updateClient,
        deleteClient,
        getClient,
        clearError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
