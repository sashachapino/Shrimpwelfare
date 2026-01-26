const CLIENT_ID = '977606447321-mt672r86crrrhfi27uh7cut96mraoo9v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

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
            discoveryDocs: [DISCOVERY_DOC],
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
