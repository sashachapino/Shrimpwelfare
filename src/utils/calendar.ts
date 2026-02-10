/// <reference types="@maxim_mazurok/gapi.client.gmail-v1" />

const CLIENT_ID = '977606447321-mt672r86crrrhfi27uh7cut96mraoo9v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'
];

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let gapiInited = false;
let gisInited = false;

type AuthCallback = (isSignedIn: boolean) => void;
let authCallback: AuthCallback | null = null;

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees: string[];
  htmlLink: string;
}

export interface SessionNotesEmail {
  id: string;
  threadId: string;
  subject: string;
  to: string[];
  sentAt: Date;
  body: string;
}

// Interface for email parts (used for recursive body extraction)
interface EmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: EmailPart[];
}

// Decode base64url encoded string
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(base64);
  }
}

// Strip HTML tags from string
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// Recursively extract body from email parts (handles nested multipart messages)
function extractEmailBody(payload: EmailPart | undefined, stripHtmlFn: (html: string) => string): string {
  if (!payload) return '';

  // If there's direct body data on this payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    // If this is HTML, strip tags
    if (payload.mimeType === 'text/html') {
      return stripHtmlFn(decoded);
    }
    return decoded;
  }

  // If there are parts, search recursively
  if (payload.parts && payload.parts.length > 0) {
    // First, try to find text/plain at any level
    const findTextPlain = (parts: EmailPart[]): string | null => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return decodeBase64Url(part.body.data);
        }
        if (part.parts) {
          const nested = findTextPlain(part.parts);
          if (nested) return nested;
        }
      }
      return null;
    };

    const textPlain = findTextPlain(payload.parts);
    if (textPlain) return textPlain;

    // If no text/plain, try text/html
    const findTextHtml = (parts: EmailPart[]): string | null => {
      for (const part of parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return stripHtmlFn(decodeBase64Url(part.body.data));
        }
        if (part.parts) {
          const nested = findTextHtml(part.parts);
          if (nested) return nested;
        }
      }
      return null;
    };

    const textHtml = findTextHtml(payload.parts);
    if (textHtml) return textHtml;
  }

  return '';
}

// Load the Google API client library
export async function loadGoogleApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Load GAPI
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiInited = true;
          maybeEnableAuth();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    };
    gapiScript.onerror = reject;
    document.head.appendChild(gapiScript);

    // Load GIS (Google Identity Services)
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            console.error('Token error:', response.error);
            authCallback?.(false);
            return;
          }
          // Store token in localStorage (persists across sessions)
          localStorage.setItem('gapi_token', JSON.stringify({
            access_token: response.access_token,
            expires_at: Date.now() + (response.expires_in * 1000),
          }));
          authCallback?.(true);
        },
      });
      gisInited = true;
      maybeEnableAuth();
    };
    gisScript.onerror = reject;
    document.head.appendChild(gisScript);
  });
}

function maybeEnableAuth() {
  if (gapiInited && gisInited) {
    // Check for existing token
    const storedToken = localStorage.getItem('gapi_token');
    if (storedToken) {
      try {
        const { access_token, expires_at } = JSON.parse(storedToken);
        if (expires_at > Date.now()) {
          gapi.client.setToken({ access_token });
          authCallback?.(true);
          return;
        }
      } catch {
        // Invalid token, clear it
        localStorage.removeItem('gapi_token');
      }
    }
    authCallback?.(false);
  }
}

export function setAuthCallback(callback: AuthCallback) {
  authCallback = callback;
}

export function isSignedIn(): boolean {
  const token = gapi.client?.getToken();
  return !!token?.access_token;
}

export function signIn(): void {
  if (!tokenClient) {
    console.error('Token client not initialized');
    return;
  }

  if (gapi.client.getToken() === null) {
    // First time sign in - prompt for consent
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip consent for returning users
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

export function signOut(): void {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null);
      localStorage.removeItem('gapi_token');
      authCallback?.(false);
    });
  }
}

export async function getUpcomingEvents(
  daysAhead: number = 14,
  clientEmails: string[]
): Promise<CalendarEvent[]> {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google Calendar');
  }

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      showDeleted: false,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.result.items || [];
    const clientEmailSet = new Set(clientEmails.map(e => e.toLowerCase()));

    // Filter events that have attendees matching client emails
    return events
      .filter((event: gapi.client.calendar.Event) => {
        if (!event.attendees) return false;
        return event.attendees.some(
          (attendee: gapi.client.calendar.EventAttendee) =>
            attendee.email && clientEmailSet.has(attendee.email.toLowerCase())
        );
      })
      .map((event: gapi.client.calendar.Event) => ({
        id: event.id!,
        summary: event.summary || 'Untitled Event',
        description: event.description,
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || ''),
        attendees: (event.attendees || [])
          .map((a: gapi.client.calendar.EventAttendee) => a.email || '')
          .filter(Boolean),
        htmlLink: event.htmlLink || '',
      }));
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    throw err;
  }
}

export async function getPastEvents(
  hoursBack: number = 24,
  clientEmails: string[]
): Promise<CalendarEvent[]> {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google Calendar');
  }

  const now = new Date();
  const past = new Date();
  past.setHours(past.getHours() - hoursBack);

  try {
    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: past.toISOString(),
      timeMax: now.toISOString(),
      showDeleted: false,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = response.result.items || [];
    const clientEmailSet = new Set(clientEmails.map(e => e.toLowerCase()));

    return events
      .filter((event: gapi.client.calendar.Event) => {
        if (!event.attendees) return false;
        // Only include events that have already ended
        const endTime = new Date(event.end?.dateTime || event.end?.date || '');
        if (endTime > now) return false;
        return event.attendees.some(
          (attendee: gapi.client.calendar.EventAttendee) =>
            attendee.email && clientEmailSet.has(attendee.email.toLowerCase())
        );
      })
      .map((event: gapi.client.calendar.Event) => ({
        id: event.id!,
        summary: event.summary || 'Untitled Event',
        description: event.description,
        start: new Date(event.start?.dateTime || event.start?.date || ''),
        end: new Date(event.end?.dateTime || event.end?.date || ''),
        attendees: (event.attendees || [])
          .map((a: gapi.client.calendar.EventAttendee) => a.email || '')
          .filter(Boolean),
        htmlLink: event.htmlLink || '',
      }));
  } catch (err) {
    console.error('Error fetching past events:', err);
    throw err;
  }
}

// Fetch sent emails with "session notes" in subject from the last N hours
export async function getSessionNotesEmails(hoursBack: number = 24): Promise<SessionNotesEmail[]> {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google');
  }

  // Check if Gmail API is available
  if (!gapi.client.gmail) {
    console.warn('Gmail API not loaded, skipping email fetch');
    return [];
  }

  try {
    // Query for sent emails with "session notes" in subject
    const afterDate = new Date();
    afterDate.setHours(afterDate.getHours() - hoursBack);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    const response = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      q: `from:me subject:session subject:notes after:${afterTimestamp}`,
      maxResults: 50,
    });

    const messages = response.result.messages || [];
    const emails: SessionNotesEmail[] = [];

    for (const msg of messages) {
      try {
        const fullMessage = await gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = fullMessage.result.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('Subject');
        const toHeader = getHeader('To');
        const dateHeader = getHeader('Date');

        // Parse recipients
        const toEmails = toHeader
          .split(',')
          .map((email: string) => {
            const match = email.match(/<([^>]+)>/) || [null, email.trim()];
            return match[1]?.toLowerCase() || '';
          })
          .filter(Boolean);

        // Get email body using recursive extraction for nested multipart messages
        const body = extractEmailBody(fullMessage.result.payload as EmailPart, stripHtml);

        emails.push({
          id: msg.id!,
          threadId: msg.threadId!,
          subject,
          to: toEmails,
          sentAt: new Date(dateHeader),
          body: body.trim(),
        });
      } catch (err) {
        console.error('Error fetching email details:', err);
      }
    }

    // Sort by date, oldest first, then deduplicate by thread
    emails.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    const seenThreads = new Set<string>();
    const uniqueEmails = emails.filter((email) => {
      if (seenThreads.has(email.threadId)) {
        return false;
      }
      seenThreads.add(email.threadId);
      return true;
    });

    return uniqueEmails;
  } catch (err) {
    console.error('Error fetching session notes emails:', err);
    throw err;
  }
}

// Fetch all session notes emails sent to a specific client (up to 1 year back)
export async function getAllSessionNotesEmailsForClient(clientEmail: string): Promise<SessionNotesEmail[]> {
  if (!isSignedIn()) {
    throw new Error('Not signed in to Google');
  }

  // Check if Gmail API is available
  if (!gapi.client.gmail) {
    console.warn('Gmail API not loaded, skipping email fetch for client:', clientEmail);
    return [];
  }

  try {
    // Query for sent emails with "session notes" in subject, sent to this client
    // Look back up to 1 year
    const afterDate = new Date();
    afterDate.setFullYear(afterDate.getFullYear() - 1);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    // Use a simpler query that's more likely to match
    // Quote the email to handle special characters like @ properly in Gmail search
    const query = `from:me subject:session subject:notes to:"${clientEmail}" after:${afterTimestamp}`;
    console.log('Gmail search query:', query);
    console.log('Client email:', clientEmail);

    const response = await gapi.client.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
    });

    console.log('Gmail search results:', response.result.messages?.length || 0, 'messages found');

    const messages = response.result.messages || [];
    const emails: SessionNotesEmail[] = [];

    for (const msg of messages) {
      try {
        const fullMessage = await gapi.client.gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = fullMessage.result.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('Subject');
        const toHeader = getHeader('To');
        const dateHeader = getHeader('Date');

        // Parse recipients
        const toEmails = toHeader
          .split(',')
          .map((email: string) => {
            const match = email.match(/<([^>]+)>/) || [null, email.trim()];
            return match[1]?.toLowerCase() || '';
          })
          .filter(Boolean);

        // Get email body using recursive extraction for nested multipart messages
        const body = extractEmailBody(fullMessage.result.payload as EmailPart, stripHtml);

        console.log('Email found:', {
          subject,
          to: toEmails,
          date: dateHeader,
          bodyLength: body.length,
          bodyPreview: body.slice(0, 100),
        });

        emails.push({
          id: msg.id!,
          threadId: msg.threadId!,
          subject,
          to: toEmails,
          sentAt: new Date(dateHeader),
          body: body.trim(),
        });
      } catch (err) {
        console.error('Error fetching email details:', err);
      }
    }

    // Sort by date, oldest first
    emails.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

    // Deduplicate by thread - keep only the first (oldest) email from each thread
    // This filters out replies to session notes emails
    const seenThreads = new Set<string>();
    const uniqueEmails = emails.filter((email) => {
      if (seenThreads.has(email.threadId)) {
        return false;
      }
      seenThreads.add(email.threadId);
      return true;
    });

    console.log('After deduplication:', uniqueEmails.length, 'unique threads');

    return uniqueEmails;
  } catch (err: unknown) {
    console.error('Error fetching all session notes emails for client:', err);
    // Provide more useful error messages
    if (err && typeof err === 'object' && 'result' in err) {
      const gapiError = err as { result?: { error?: { message?: string } } };
      if (gapiError.result?.error?.message) {
        throw new Error(gapiError.result.error.message);
      }
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to fetch emails from Gmail');
  }
}
