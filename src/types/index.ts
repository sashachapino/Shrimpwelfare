// Client data model for the coaching CRM

export interface SessionNote {
  id: string;
  sessionNumber: number;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type EnneagramType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | '?';
export type ClientStatus = 'active' | 'occasional' | 'archived';

export interface Client {
  id: string;
  name: string;
  email: string;
  enneagramType: EnneagramType;
  enneagramSecondary: EnneagramType | null; // optional secondary type (bitype)
  status: ClientStatus;
  sessionsCompleted: number;
  unpaidHours: number; // supports decimals (e.g., 1.5 for 1.5 hours)
  hourlyRate: number; // dollar rate per hour
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

// Calendar integration types
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees: string[];
  htmlLink: string;
}

export interface PostCallNotification {
  id: string;
  eventId: string;
  clientId: string;
  clientName: string;
  eventSummary: string;
  eventStart: Date;
  eventEnd: Date;
  dismissed: boolean;
  // Gmail integration fields
  sessionNotesEmail?: string; // Email body if found
  suggestedHours: number; // Calculated from event duration, default 1
}
