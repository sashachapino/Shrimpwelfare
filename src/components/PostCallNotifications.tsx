import { Link } from 'react-router-dom';
import { Bell, X, Clock, FileText, DollarSign } from 'lucide-react';
import { useCalendar } from '../contexts/CalendarContext';
import type { PostCallNotification } from '../types';
import styles from './PostCallNotifications.module.css';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

interface NotificationCardProps {
  notification: PostCallNotification;
  onDismiss: (id: string) => void;
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  return (
    <div className={styles.notification}>
      <button
        className={styles.dismissBtn}
        onClick={() => onDismiss(notification.id)}
        title="Dismiss"
      >
        <X size={16} />
      </button>
      <div className={styles.notificationContent}>
        <div className={styles.notificationHeader}>
          <Bell size={16} className={styles.bellIcon} />
          <span className={styles.timeAgo}>
            <Clock size={12} />
            {formatTimeAgo(notification.eventEnd)}
          </span>
        </div>
        <p className={styles.message}>
          Session with <strong>{notification.clientName}</strong> ended
        </p>
        <p className={styles.eventTitle}>{notification.eventSummary}</p>
        <div className={styles.actions}>
          <Link
            to={`/client/${notification.clientId}?action=addSession`}
            className={styles.actionBtn}
          >
            <FileText size={14} />
            Add Notes
          </Link>
          <Link
            to={`/client/${notification.clientId}?action=addHours`}
            className={styles.actionBtnSecondary}
          >
            <DollarSign size={14} />
            Update Hours
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PostCallNotifications() {
  const { notifications, dismissNotification, isCalendarConnected } = useCalendar();

  if (!isCalendarConnected || notifications.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          <Bell size={16} />
          Recent Sessions
        </h3>
        <span className={styles.count}>{notifications.length}</span>
      </div>
      <div className={styles.notificationList}>
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </div>
  );
}
