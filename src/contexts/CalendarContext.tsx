import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  loadGoogleApi,
  setAuthCallback,
  signIn as googleSignIn,
  signOut as googleSignOut,
  getUpcomingEvents,
  getPastEvents,
  getSessionNotesEmails,
  getAllSessionNotesEmailsForClient,
  type CalendarEvent,
  type SessionNotesEmail,
} from '../utils/calendar';
import { loadNotifications, saveNotifications } from '../utils/storage';
import { useApp } from './AppContext';
import type { PostCallNotification, SessionNote } from '../types';

interface CalendarContextType {
  isCalendarConnected: boolean;
  isLoading: boolean;
  upcomingEvents: CalendarEvent[];
  notifications: PostCallNotification[];
  connectCalendar: () => void;
  disconnectCalendar: () => void;
  refreshEvents: () => Promise<void>;
  dismissNotification: (notificationId: string) => void;
  confirmSessionNotes: (notificationId: string, notes: string, hours: number) => Promise<void>;
  getClientForEvent: (event: CalendarEvent) => { id: string; name: string } | null;
  syncClientNotes: (clientId: string) => Promise<{ imported: number; error?: string }>;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

const DISMISSED_NOTIFICATIONS_KEY = 'dismissed_notifications';
const PAST_EVENTS_DAYS = 30; // Look back 30 days for notifications

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { clients, isUnlocked, updateClient, getClient, password } = useApp();
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<PostCallNotification[]>([]);

  // Load dismissed notification IDs from localStorage
  const getDismissedIds = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }, []);

  const saveDismissedIds = useCallback((ids: Set<string>) => {
    localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify([...ids]));
  }, []);

  // Get client matching an event's attendees
  const getClientForEvent = useCallback(
    (event: CalendarEvent): { id: string; name: string } | null => {
      for (const client of clients) {
        if (!client.email) continue;
        const clientEmail = client.email.toLowerCase();
        if (event.attendees.some((a) => a.toLowerCase() === clientEmail)) {
          return { id: client.id, name: client.name };
        }
      }
      return null;
    },
    [clients]
  );

  // Initialize Google API
  useEffect(() => {
    if (!isUnlocked) return;

    setAuthCallback((signedIn) => {
      setIsCalendarConnected(signedIn);
      setIsLoading(false);
    });

    loadGoogleApi()
      .then(() => {
        setApiLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load Google API:', err);
        setIsLoading(false);
      });
  }, [isUnlocked]);

  // Load persisted notifications on startup
  useEffect(() => {
    if (!isUnlocked || !password) return;

    loadNotifications(password).then((persisted) => {
      if (persisted.length > 0) {
        setNotifications(persisted);
      }
    }).catch((err) => {
      console.error('Error loading persisted notifications:', err);
    });
  }, [isUnlocked, password]);

  // Save notifications when they change
  const persistNotifications = useCallback(
    async (notifs: PostCallNotification[]) => {
      if (!password) return;
      try {
        await saveNotifications(notifs, password);
      } catch (err) {
        console.error('Error saving notifications:', err);
      }
    },
    [password]
  );

  // Fetch events when connected
  const refreshEvents = useCallback(async () => {
    if (!isCalendarConnected || !apiLoaded) return;

    const clientEmails = clients
      .filter((c) => c.email && c.status !== 'archived')
      .map((c) => c.email);

    if (clientEmails.length === 0) {
      setUpcomingEvents([]);
      return;
    }

    try {
      // Fetch upcoming events
      const upcoming = await getUpcomingEvents(14, clientEmails);
      setUpcomingEvents(upcoming);

      // Fetch past events for notifications (extended to 30 days)
      const pastHours = PAST_EVENTS_DAYS * 24;
      const past = await getPastEvents(pastHours, clientEmails);
      const dismissedIds = getDismissedIds();

      // Fetch session notes emails (up to 30 days)
      let sessionEmails: SessionNotesEmail[] = [];
      try {
        sessionEmails = await getSessionNotesEmails(pastHours);
      } catch (err) {
        console.error('Error fetching session notes emails:', err);
      }

      // Helper to find matching email for a client
      const findEmailForClient = (clientEmail: string, eventEnd: Date): SessionNotesEmail | undefined => {
        const clientEmailLower = clientEmail.toLowerCase();
        // Find emails sent to this client within 24 hours after the event ended
        const oneDayAfter = new Date(eventEnd.getTime() + 24 * 60 * 60 * 1000);
        return sessionEmails.find(
          (email) =>
            email.to.some((to) => to.toLowerCase() === clientEmailLower) &&
            email.sentAt >= eventEnd &&
            email.sentAt <= oneDayAfter
        );
      };

      // Build new notifications from calendar events
      const calendarNotifications: PostCallNotification[] = past
        .filter((event) => !dismissedIds.has(event.id))
        .map((event) => {
          const client = getClientForEvent(event);
          const clientObj = clients.find((c) => c.id === client?.id);

          // Find matching email
          const matchedEmail = clientObj?.email
            ? findEmailForClient(clientObj.email, event.end)
            : undefined;

          // Calculate suggested hours from event duration
          const durationMs = event.end.getTime() - event.start.getTime();
          const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 2) / 2;
          const suggestedHours = Math.max(0.5, Math.min(durationHours, 4));

          return {
            id: event.id,
            eventId: event.id,
            clientId: client?.id || '',
            clientName: client?.name || 'Unknown Client',
            eventSummary: event.summary,
            eventStart: event.start,
            eventEnd: event.end,
            dismissed: false,
            sessionNotesEmail: matchedEmail?.body,
            suggestedHours,
          };
        })
        .filter((n) => n.clientId);

      // Merge with any persisted notifications that are still valid
      setNotifications((prev) => {
        // Create a map of new notification IDs
        const newIds = new Set(calendarNotifications.map((n) => n.id));
        // Keep persisted notifications that aren't in the new set and aren't dismissed
        const persistedStillValid = prev.filter(
          (p) => !newIds.has(p.id) && !dismissedIds.has(p.id)
        );
        const merged = [...calendarNotifications, ...persistedStillValid];
        // Save merged notifications
        persistNotifications(merged);
        return merged;
      });
    } catch (err) {
      console.error('Error refreshing events:', err);
    }
  }, [isCalendarConnected, apiLoaded, clients, getDismissedIds, getClientForEvent, persistNotifications]);

  // Auto-refresh events
  useEffect(() => {
    if (isCalendarConnected && apiLoaded) {
      refreshEvents();
      // Refresh every 5 minutes
      const interval = setInterval(refreshEvents, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isCalendarConnected, apiLoaded, refreshEvents]);

  const connectCalendar = useCallback(() => {
    if (apiLoaded) {
      googleSignIn();
    }
  }, [apiLoaded]);

  const disconnectCalendar = useCallback(() => {
    googleSignOut();
    setUpcomingEvents([]);
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback(
    (notificationId: string) => {
      const dismissedIds = getDismissedIds();
      dismissedIds.add(notificationId);
      saveDismissedIds(dismissedIds);
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== notificationId);
        persistNotifications(updated);
        return updated;
      });
    },
    [getDismissedIds, saveDismissedIds, persistNotifications]
  );

  // Confirm session notes and add to client
  const confirmSessionNotes = useCallback(
    async (notificationId: string, notes: string, hours: number) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification) return;

      const client = getClient(notification.clientId);
      if (!client) return;

      // Create new session note
      const newSession = {
        id: crypto.randomUUID(),
        sessionNumber: client.sessionsCompleted + 1,
        date: notification.eventStart.toISOString().split('T')[0],
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Update client with new session and unpaid hours
      await updateClient(notification.clientId, {
        sessionsCompleted: client.sessionsCompleted + 1,
        unpaidHours: (client.unpaidHours ?? 0) + hours,
        sessionNotes: [...client.sessionNotes, newSession],
      });

      // Dismiss the notification
      dismissNotification(notificationId);
    },
    [notifications, getClient, updateClient, dismissNotification]
  );

  // Sync past session notes from Gmail for a specific client
  const syncClientNotes = useCallback(
    async (clientId: string): Promise<{ imported: number; error?: string }> => {
      const client = getClient(clientId);
      if (!client?.email) {
        return { imported: 0, error: 'Client has no email address' };
      }

      if (!isCalendarConnected) {
        return { imported: 0, error: 'Calendar/Gmail not connected' };
      }

      try {
        // Fetch all session notes emails for this client (up to 1 year)
        const emails = await getAllSessionNotesEmailsForClient(client.email);

        if (emails.length === 0) {
          return { imported: 0 };
        }

        // Get existing session note dates to avoid duplicates
        const existingDates = new Set(
          client.sessionNotes.map((n) => n.date)
        );

        // Filter out emails that would be duplicates
        const newEmails = emails.filter((email) => {
          const dateStr = email.sentAt.toISOString().split('T')[0];
          return !existingDates.has(dateStr);
        });

        if (newEmails.length === 0) {
          return { imported: 0 };
        }

        // Create session notes from emails
        const newNotes: SessionNote[] = newEmails.map((email, index) => ({
          id: crypto.randomUUID(),
          sessionNumber: client.sessionsCompleted + index + 1,
          date: email.sentAt.toISOString().split('T')[0],
          notes: email.body.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // Sort by date
        newNotes.sort((a, b) => a.date.localeCompare(b.date));

        // Renumber all session notes
        const allNotes = [...client.sessionNotes, ...newNotes].sort(
          (a, b) => a.date.localeCompare(b.date)
        );
        allNotes.forEach((note, index) => {
          note.sessionNumber = index + 1;
        });

        // Update client
        await updateClient(clientId, {
          sessionNotes: allNotes,
          sessionsCompleted: allNotes.length,
        });

        return { imported: newNotes.length };
      } catch (err) {
        console.error('Error syncing client notes:', err);
        return {
          imported: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [getClient, isCalendarConnected, updateClient]
  );

  return (
    <CalendarContext.Provider
      value={{
        isCalendarConnected,
        isLoading,
        upcomingEvents,
        notifications,
        connectCalendar,
        disconnectCalendar,
        refreshEvents,
        dismissNotification,
        confirmSessionNotes,
        getClientForEvent,
        syncClientNotes,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
