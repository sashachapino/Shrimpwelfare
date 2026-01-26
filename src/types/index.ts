// Client data model for the coaching CRM

export interface SessionNote {
  id: string;
  sessionNumber: number;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  sessionsCompleted: number;
  unpaidSessions: number;
  sessionNotes: SessionNote[];
  overallNotes: string;
  currentQuestions: string;
  allianceStrength: number; // 1-10
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedStore {
  iv: string;
  salt: string;
  data: string;
}

export interface AppState {
  clients: Client[];
  isUnlocked: boolean;
  hasExistingData: boolean;
}
