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
  type CalendarEvent,
} from '../utils/calendar';
import { useApp } from './AppContext';
import type { PostCallNotification } from '../types';

interface CalendarContextType {
  isCalendarConnected: boolean;
  isLoading: boolean;
  upcomingEvents: CalendarEvent[];
  notifications: PostCallNotification[];
  connectCalendar: () => void;
  disconnectCalendar: () => void;
  refreshEvents: () => Promise<void>;
  dismissNotification: (notificationId: string) => void;
  getClientForEvent: (event: CalendarEvent) => { id: string; name: string } | null;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

const DISMISSED_NOTIFICATIONS_KEY = 'dismissed_notifications';

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { clients, isUnlocked } = useApp();
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

  // Fetch events when connected
  const refreshEvents = useCallback(async () => {
    if (!isCalendarConnected || !apiLoaded) return;

    const clientEmails = clients
      .filter((c) => c.email && c.status !== 'archived')
      .map((c) => c.email);

    if (clientEmails.length === 0) {
      setUpcomingEvents([]);
      setNotifications([]);
      return;
    }

    try {
      // Fetch upcoming events
      const upcoming = await getUpcomingEvents(14, clientEmails);
      setUpcomingEvents(upcoming);

      // Fetch past events for notifications
      const past = await getPastEvents(48, clientEmails);
      const dismissedIds = getDismissedIds();

      const newNotifications: PostCallNotification[] = past
        .filter((event) => !dismissedIds.has(event.id))
        .map((event) => {
          const client = getClientForEvent(event);
          return {
            id: event.id,
            eventId: event.id,
            clientId: client?.id || '',
            clientName: client?.name || 'Unknown Client',
            eventSummary: event.summary,
            eventEnd: event.end,
            dismissed: false,
          };
        })
        .filter((n) => n.clientId); // Only include if we found a matching client

      setNotifications(newNotifications);
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
      const dismissedIds = getDismissedIds();
      dismissedIds.add(notificationId);
      saveDismissedIds(dismissedIds);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    },
    [getDismissedIds, saveDismissedIds]
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
        getClientForEvent,
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
