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
  getAllSessionNotesEmailsForClient,
  type CalendarEvent,
} from '../utils/calendar';
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
  const { clients, isUnlocked, updateClient, getClient } = useApp();
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<PostCallNotification[]>([]);

  // Load dismissed notification IDs from localStorage
  const getDismissedIds = useCallback((): Set<string> => {
    try {
      const stored = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
      const ids = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
      console.log('Loaded dismissed IDs:', ids.size, 'items');
      return ids;
    } catch {
      return new Set();
    }
  }, []);

  const saveDismissedIds = useCallback((ids: Set<string>) => {
    console.log('Saving dismissed IDs:', ids.size, 'items');
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

      console.log('Past events found:', past.length);
      console.log('Dismissed IDs count:', dismissedIds.size);

      // Build notifications from calendar events, fetching emails per-client
      const calendarNotifications: PostCallNotification[] = [];
      let skippedDismissed = 0;

      for (const event of past) {
        if (dismissedIds.has(event.id)) {
          skippedDismissed++;
          continue;
        }

        const client = getClientForEvent(event);
        if (!client?.id) continue;

        const clientObj = clients.find((c) => c.id === client.id);
        if (!clientObj?.email) continue;

        // Search for session notes email specifically for this client
        let emailBody: string | undefined;
        try {
          const emails = await getAllSessionNotesEmailsForClient(clientObj.email);
          // Find email sent within 7 days after event
          const oneWeekAfter = new Date(event.end.getTime() + 7 * 24 * 60 * 60 * 1000);
          const matchingEmail = emails.find(
            (e) => e.sentAt >= event.end && e.sentAt <= oneWeekAfter
          );
          emailBody = matchingEmail?.body;
        } catch (err) {
          console.error('Error fetching emails for client:', clientObj.email, err);
        }

        // Calculate suggested hours from event duration
        const durationMs = event.end.getTime() - event.start.getTime();
        const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 2) / 2;
        const suggestedHours = Math.max(0.5, Math.min(durationHours, 4));

        calendarNotifications.push({
          id: event.id,
          eventId: event.id,
          clientId: client.id,
          clientName: client.name,
          eventSummary: event.summary,
          eventStart: event.start,
          eventEnd: event.end,
          dismissed: false,
          sessionNotesEmail: emailBody,
          suggestedHours,
        });
      }

      console.log('Skipped (dismissed):', skippedDismissed);
      console.log('Notifications to show:', calendarNotifications.length);

      setNotifications(calendarNotifications);
    } catch (err) {
      console.error('Error refreshing events:', err);
    }
  }, [isCalendarConnected, apiLoaded, clients, getDismissedIds, getClientForEvent]);

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
      console.log('Dismissing notification:', notificationId);
      const dismissedIds = getDismissedIds();
      dismissedIds.add(notificationId);
      saveDismissedIds(dismissedIds);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    },
    [getDismissedIds, saveDismissedIds]
  );

  // Helper to check if content is a duplicate (looks for 30+ char matching substring)
  const isDuplicateContent = (newContent: string, existingNotes: SessionNote[]): boolean => {
    const newText = newContent.trim();
    if (newText.length < 30) return false;

    // Extract a chunk from the middle of the new content (skip boilerplate at start)
    const startPos = Math.min(50, Math.floor(newText.length / 4));
    const chunk = newText.slice(startPos, startPos + 30);

    return existingNotes.some((note) => note.notes.includes(chunk));
  };

  // Confirm session notes and add to client
  const confirmSessionNotes = useCallback(
    async (notificationId: string, notes: string, hours: number) => {
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification) return;

      const client = getClient(notification.clientId);
      if (!client) return;

      // Check if this is a duplicate
      if (isDuplicateContent(notes, client.sessionNotes)) {
        // Just dismiss without adding
        dismissNotification(notificationId);
        return;
      }

      // Create new session note
      const newSession: SessionNote = {
        id: crypto.randomUUID(),
        sessionNumber: 0, // Will be renumbered
        date: notification.eventStart.toISOString().split('T')[0],
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Combine all notes, sort by date, and renumber sequentially
      const allNotes = [...client.sessionNotes, newSession]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((note, index) => ({
          ...note,
          sessionNumber: index + 1,
        }));

      // Update client with new session and unpaid hours
      await updateClient(notification.clientId, {
        sessionsCompleted: allNotes.length,
        unpaidHours: (client.unpaidHours ?? 0) + hours,
        sessionNotes: allNotes,
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

        // Filter out duplicate emails by checking content similarity
        const newEmails = emails.filter((email) => {
          return !isDuplicateContent(email.body, client.sessionNotes);
        });

        if (newEmails.length === 0) {
          return { imported: 0 };
        }

        // Create session notes from emails (temporary session numbers)
        const newNotes: SessionNote[] = newEmails.map((email) => ({
          id: crypto.randomUUID(),
          sessionNumber: 0, // Will be renumbered
          date: email.sentAt.toISOString().split('T')[0],
          notes: email.body.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        // Combine all notes, sort by date, and renumber sequentially
        const allNotes = [...client.sessionNotes, ...newNotes]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((note, index) => ({
            ...note,
            sessionNumber: index + 1,
          }));

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
