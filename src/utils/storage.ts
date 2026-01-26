// Secure local storage using IndexedDB with encryption
import type { Client, EncryptedStore } from '../types';
import { encrypt, decrypt, hashPassword } from './crypto';

const DB_NAME = 'coaching-crm';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted-data';
const PASSWORD_HASH_KEY = 'password-hash';
const DATA_KEY = 'clients-data';
const SETTINGS_KEY = 'settings-data';

export interface AppSettings {
  anthropicApiKey?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

async function setValue<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function hasExistingData(): Promise<boolean> {
  const hash = await getValue<string>(PASSWORD_HASH_KEY);
  return hash !== null;
}

export async function initializeWithPassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  await setValue(PASSWORD_HASH_KEY, hash);
  await saveClients([], password);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const storedHash = await getValue<string>(PASSWORD_HASH_KEY);
  if (!storedHash) return false;

  const hash = await hashPassword(password);
  return hash === storedHash;
}

export async function loadClients(password: string): Promise<Client[]> {
  const encrypted = await getValue<EncryptedStore>(DATA_KEY);
  if (!encrypted) return [];

  try {
    const decrypted = await decrypt(
      encrypted.data,
      password,
      encrypted.iv,
      encrypted.salt
    );
    return JSON.parse(decrypted) as Client[];
  } catch {
    throw new Error('Failed to decrypt data. Incorrect password?');
  }
}

export async function saveClients(clients: Client[], password: string): Promise<void> {
  const data = JSON.stringify(clients);
  const { iv, salt, ciphertext } = await encrypt(data, password);

  const encrypted: EncryptedStore = {
    iv,
    salt,
    data: ciphertext,
  };

  await setValue(DATA_KEY, encrypted);
}

export async function exportData(password: string): Promise<string> {
  const clients = await loadClients(password);
  return JSON.stringify(clients, null, 2);
}

export async function importData(jsonData: string, password: string): Promise<void> {
  const clients = JSON.parse(jsonData) as Client[];
  await saveClients(clients, password);
}

export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadSettings(password: string): Promise<AppSettings> {
  const encrypted = await getValue<EncryptedStore>(SETTINGS_KEY);
  if (!encrypted) return {};

  try {
    const decrypted = await decrypt(
      encrypted.data,
      password,
      encrypted.iv,
      encrypted.salt
    );
    return JSON.parse(decrypted) as AppSettings;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: AppSettings, password: string): Promise<void> {
  const data = JSON.stringify(settings);
  const { iv, salt, ciphertext } = await encrypt(data, password);

  const encrypted: EncryptedStore = {
    iv,
    salt,
    data: ciphertext,
  };

  await setValue(SETTINGS_KEY, encrypted);
}
