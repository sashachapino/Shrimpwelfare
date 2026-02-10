// Secure local storage using IndexedDB with encryption
import type { Client, EncryptedStore, PostCallNotification } from '../types';
import { encrypt, decrypt, hashPassword } from './crypto';

// Serialized version of PostCallNotification (dates as strings)
interface SerializedNotification extends Omit<PostCallNotification, 'eventStart' | 'eventEnd'> {
  eventStart: string;
  eventEnd: string;
}

const DB_NAME = 'coaching-crm';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted-data';
const PASSWORD_HASH_KEY = 'password-hash';
const DATA_KEY = 'clients-data';
const SETTINGS_KEY = 'settings-data';
const NOTIFICATIONS_KEY = 'notifications-data';

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

// Notification persistence functions
export async function loadNotifications(password: string): Promise<PostCallNotification[]> {
  const encrypted = await getValue<EncryptedStore>(NOTIFICATIONS_KEY);
  if (!encrypted) return [];

  try {
    const decrypted = await decrypt(
      encrypted.data,
      password,
      encrypted.iv,
      encrypted.salt
    );
    const serialized = JSON.parse(decrypted) as SerializedNotification[];
    // Convert date strings back to Date objects
    return serialized.map(n => ({
      ...n,
      eventStart: new Date(n.eventStart),
      eventEnd: new Date(n.eventEnd),
    }));
  } catch {
    return [];
  }
}

export async function saveNotifications(notifications: PostCallNotification[], password: string): Promise<void> {
  // Convert Date objects to strings for serialization
  const serialized: SerializedNotification[] = notifications.map(n => ({
    ...n,
    eventStart: n.eventStart.toISOString(),
    eventEnd: n.eventEnd.toISOString(),
  }));

  const data = JSON.stringify(serialized);
  const { iv, salt, ciphertext } = await encrypt(data, password);

  const encrypted: EncryptedStore = {
    iv,
    salt,
    data: ciphertext,
  };

  await setValue(NOTIFICATIONS_KEY, encrypted);
}

// Encrypted backup functions - exports data in encrypted form (safe for cloud storage)
export interface EncryptedBackup {
  version: number;
  createdAt: string;
  passwordHash: string;
  clients: EncryptedStore | null;
  settings: EncryptedStore | null;
}

export async function exportEncryptedBackup(): Promise<EncryptedBackup> {
  const passwordHash = await getValue<string>(PASSWORD_HASH_KEY);
  const clients = await getValue<EncryptedStore>(DATA_KEY);
  const settings = await getValue<EncryptedStore>(SETTINGS_KEY);

  if (!passwordHash) {
    throw new Error('No data to export');
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    passwordHash,
    clients,
    settings,
  };
}

export async function importEncryptedBackup(backup: EncryptedBackup, password: string): Promise<void> {
  // Verify password matches the backup
  const hash = await hashPassword(password);
  if (hash !== backup.passwordHash) {
    throw new Error('Password does not match the backup. Use the password you had when the backup was created.');
  }

  // Restore password hash
  await setValue(PASSWORD_HASH_KEY, backup.passwordHash);

  // Restore clients if present
  if (backup.clients) {
    await setValue(DATA_KEY, backup.clients);
  }

  // Restore settings if present
  if (backup.settings) {
    await setValue(SETTINGS_KEY, backup.settings);
  }
}

// Download backup file (triggers browser download)
export async function downloadBackup(): Promise<void> {
  const backup = await exportEncryptedBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `coaching-crm-backup-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Restore from backup file
export async function restoreFromBackup(file: File, password: string): Promise<void> {
  const text = await file.text();
  const backup = JSON.parse(text) as EncryptedBackup;

  if (!backup.version || !backup.passwordHash) {
    throw new Error('Invalid backup file format');
  }

  await importEncryptedBackup(backup, password);
}

// ============================================
// CSV Import for migrating from other CRMs
// ============================================

interface CsvRow {
  [key: string]: string;
}

function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header row - handle quoted fields
  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

// Map common CRM field names to our Client fields
function findField(row: CsvRow, ...possibleNames: string[]): string {
  for (const name of possibleNames) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (row[key] !== undefined && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function parseEnneagramType(value: string): Client['enneagramType'] {
  const num = parseInt(value, 10);
  if (num >= 1 && num <= 9) return num as Client['enneagramType'];
  return '?';
}

function parseStatus(value: string): Client['status'] {
  const lower = value.toLowerCase();
  if (lower.includes('archive') || lower.includes('inactive') || lower.includes('former')) {
    return 'archived';
  }
  if (lower.includes('occasional') || lower.includes('pause') || lower.includes('sporadic')) {
    return 'occasional';
  }
  return 'active';
}

export interface CsvImportResult {
  clients: Client[];
  warnings: string[];
}

export function parseClientsFromCSV(csvText: string, existingClients: Client[]): CsvImportResult {
  const rows = parseCSV(csvText);
  const warnings: string[] = [];
  const clients: Client[] = [];
  const existingEmails = new Set(existingClients.map(c => c.email.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Try to find name - required field
    const name = findField(row,
      'name', 'fullname', 'full_name', 'clientname', 'client_name',
      'firstname', 'first_name', 'contact', 'client'
    );

    if (!name) {
      warnings.push(`Row ${i + 2}: Skipped - no name found`);
      continue;
    }

    // Try to find email
    const email = findField(row,
      'email', 'emailaddress', 'email_address', 'mail', 'contact_email'
    );

    // Check for duplicates
    if (email && existingEmails.has(email.toLowerCase())) {
      warnings.push(`Row ${i + 2}: "${name}" skipped - email already exists`);
      continue;
    }

    // Parse other fields with sensible defaults
    const enneagramRaw = findField(row,
      'enneagram', 'enneagramtype', 'enneagram_type', 'type', 'enneatype'
    );

    const statusRaw = findField(row,
      'status', 'clientstatus', 'client_status', 'state', 'active'
    );

    const sessionsRaw = findField(row,
      'sessions', 'sessionscompleted', 'sessions_completed', 'totalsessions', 'session_count'
    );

    const rateRaw = findField(row,
      'rate', 'hourlyrate', 'hourly_rate', 'price', 'fee'
    );

    const notes = findField(row,
      'notes', 'overallnotes', 'overall_notes', 'comments', 'description', 'bio'
    );

    const now = new Date().toISOString();
    const client: Client = {
      id: crypto.randomUUID(),
      name,
      email: email || '',
      enneagramType: parseEnneagramType(enneagramRaw),
      enneagramSecondary: null,
      status: parseStatus(statusRaw),
      sessionsCompleted: parseInt(sessionsRaw, 10) || 0,
      unpaidHours: 0,
      hourlyRate: parseFloat(rateRaw) || 0,
      sessionNotes: [],
      overallNotes: notes,
      currentQuestions: '',
      allianceStrength: 5,
      createdAt: now,
      updatedAt: now,
    };

    clients.push(client);
    if (email) existingEmails.add(email.toLowerCase());
  }

  return { clients, warnings };
}

export async function importClientsFromCSV(
  csvText: string,
  password: string,
  mergeWithExisting: boolean = true
): Promise<CsvImportResult> {
  const existingClients = mergeWithExisting ? await loadClients(password) : [];
  const { clients: newClients, warnings } = parseClientsFromCSV(csvText, existingClients);

  const allClients = [...existingClients, ...newClients];
  await saveClients(allClients, password);

  return { clients: newClients, warnings };
}
