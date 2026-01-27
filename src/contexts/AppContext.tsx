import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Client } from '../types';
import { hasExistingData, initializeWithPassword, verifyPassword, loadClients, saveClients, loadSettings, saveSettings } from '../utils/storage';

interface AppContextType {
  isUnlocked: boolean;
  hasData: boolean;
  clients: Client[];
  password: string | null;
  loading: boolean;
  error: string | null;
  anthropicApiKey: string | null;
  unlock: (password: string) => Promise<boolean>;
  initialize: (password: string) => Promise<void>;
  lock: () => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Client | undefined;
  setAnthropicApiKey: (key: string) => Promise<void>;
  reloadClients: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Migrate old client data to include new fields
function migrateClient(client: Partial<Client> & { enneagramWing?: number | null }): Client {
  // Migrate enneagramWing to enneagramSecondary if it exists
  const enneagramSecondary = client.enneagramSecondary !== undefined
    ? client.enneagramSecondary
    : (client.enneagramWing as Client['enneagramSecondary']) ?? null;

  return {
    id: client.id ?? crypto.randomUUID(),
    name: client.name ?? '',
    email: client.email ?? '',
    enneagramType: client.enneagramType ?? '?',
    enneagramSecondary,
    status: client.status ?? 'active',
    sessionsCompleted: client.sessionsCompleted ?? 0,
    unpaidHours: client.unpaidHours ?? (client as { unpaidSessions?: number }).unpaidSessions ?? 0,
    hourlyRate: client.hourlyRate ?? 0,
    sessionNotes: client.sessionNotes ?? [],
    overallNotes: client.overallNotes ?? '',
    currentQuestions: client.currentQuestions ?? '',
    allianceStrength: client.allianceStrength ?? 5,
    createdAt: client.createdAt ?? new Date().toISOString(),
    updatedAt: client.updatedAt ?? new Date().toISOString(),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anthropicApiKey, setAnthropicApiKeyState] = useState<string | null>(null);

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
      // Migrate old client data to include new fields
      const migratedData = data.map(migrateClient);
      setClients(migratedData);
      setPassword(pwd);
      setIsUnlocked(true);
      // Save migrated data back to storage
      if (JSON.stringify(data) !== JSON.stringify(migratedData)) {
        await saveClients(migratedData, pwd);
      }
      // Load settings including API key
      const settings = await loadSettings(pwd);
      setAnthropicApiKeyState(settings.anthropicApiKey || null);
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
    setAnthropicApiKeyState(null);
  }, []);

  const setAnthropicApiKey = useCallback(async (key: string) => {
    if (!password) return;
    setAnthropicApiKeyState(key);
    const settings = await loadSettings(password);
    await saveSettings({ ...settings, anthropicApiKey: key }, password);
  }, [password]);

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

  const reloadClients = useCallback(async () => {
    if (!password) return;
    try {
      const data = await loadClients(password);
      const migratedData = data.map(migrateClient);
      setClients(migratedData);
      // Also reload settings
      const settings = await loadSettings(password);
      setAnthropicApiKeyState(settings.anthropicApiKey || null);
    } catch (err) {
      setError('Failed to reload data');
    }
  }, [password]);

  return (
    <AppContext.Provider
      value={{
        isUnlocked,
        hasData,
        clients,
        password,
        loading,
        error,
        anthropicApiKey,
        unlock,
        initialize,
        lock,
        addClient,
        updateClient,
        deleteClient,
        getClient,
        setAnthropicApiKey,
        reloadClients,
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
