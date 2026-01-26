import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ExternalLink,
  CalendarX,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCalendar } from '../contexts/CalendarContext';
import styles from './UpcomingCalls.module.css';

interface UpcomingCallsProps {
  collapsible?: boolean;
}

function formatEventDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const minutes = Math.round(durationMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function UpcomingCalls({ collapsible = false }: UpcomingCallsProps) {
  const {
    isCalendarConnected,
    isLoading,
    upcomingEvents,
    connectCalendar,
    disconnectCalendar,
    refreshEvents,
    getClientForEvent,
  } = useCalendar();
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>
            <Calendar size={20} />
            Upcoming Calls
          </h2>
        </div>
        <div className={styles.loading}>Loading calendar...</div>
      </div>
    );
  }

  if (!isCalendarConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>
            <Calendar size={20} />
            Upcoming Calls
          </h2>
        </div>
        <div className={styles.connectPrompt}>
          <CalendarX className={styles.promptIcon} />
          <p>Connect your Google Calendar to see upcoming client calls</p>
          <button onClick={connectCalendar} className="btn-accent">
            <Calendar size={18} />
            Connect Calendar
          </button>
        </div>
      </div>
    );
  }

  const showContent = !collapsible || isExpanded;

  return (
    <div className={styles.container}>
      {collapsible ? (
        <button
          type="button"
          className={styles.collapsibleHeader}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={styles.headerLeft}>
            <Calendar size={18} />
            <span>Upcoming Calls</span>
            {upcomingEvents.length > 0 && (
              <span className={styles.eventCount}>{upcomingEvents.length}</span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      ) : (
        <div className={styles.header}>
          <h2>
            <Calendar size={20} />
            Upcoming Calls
          </h2>
          <div className={styles.headerActions}>
            <button
              onClick={() => refreshEvents()}
              className={styles.refreshBtn}
              title="Refresh events"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={disconnectCalendar}
              className={styles.disconnectBtn}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {showContent && (
        <>
          {collapsible && (
            <div className={styles.headerActions} style={{ padding: '0 var(--space-lg)', marginBottom: 'var(--space-md)' }}>
              <button
                onClick={() => refreshEvents()}
                className={styles.refreshBtn}
                title="Refresh events"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={disconnectCalendar}
                className={styles.disconnectBtn}
              >
                Disconnect
              </button>
            </div>
          )}
          {upcomingEvents.length === 0 ? (
            <div className={styles.empty}>
              <p>No upcoming calls with clients in the next 2 weeks</p>
            </div>
          ) : (
            <div className={styles.eventList}>
              {upcomingEvents.map((event) => {
                const client = getClientForEvent(event);
                return (
                  <div key={event.id} className={styles.eventCard}>
                    <div className={styles.eventTime}>
                      <Clock size={14} />
                      {formatEventDate(event.start)}
                      <span className={styles.duration}>
                        ({formatDuration(event.start, event.end)})
                      </span>
                    </div>
                    <div className={styles.eventMain}>
                      <h3 className={styles.eventTitle}>{event.summary}</h3>
                      {client && (
                        <Link
                          to={`/client/${client.id}`}
                          className={styles.clientLink}
                        >
                          {client.name}
                        </Link>
                      )}
                    </div>
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.calendarLink}
                      title="Open in Google Calendar"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
