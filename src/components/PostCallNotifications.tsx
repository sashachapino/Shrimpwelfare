import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, Clock, FileText, DollarSign, Mail, ChevronDown, ChevronUp, Check, Edit3 } from 'lucide-react';
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

function formatDuration(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  if (hours < 1) {
    return `${Math.round(hours * 60)}min`;
  }
  return `${hours.toFixed(1)}h`;
}

interface NotificationCardProps {
  notification: PostCallNotification;
  onDismiss: (id: string) => void;
  onConfirm: (id: string, notes: string, hours: number) => Promise<void>;
}

function NotificationCard({ notification, onDismiss, onConfirm }: NotificationCardProps) {
  const [hours, setHours] = useState(notification.suggestedHours);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notification.sessionNotesEmail || '');
  const [isConfirming, setIsConfirming] = useState(false);

  const hasEmail = !!notification.sessionNotesEmail;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss(notification.id);
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(notification.id, editedNotes, hours);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className={styles.notification}>
      <button
        className={styles.dismissBtn}
        onClick={handleDismiss}
        title="Dismiss"
        type="button"
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
        <p className={styles.eventTitle}>
          {notification.eventSummary}
          <span className={styles.duration}>
            ({formatDuration(notification.eventStart, notification.eventEnd)})
          </span>
        </p>

        {/* Email detection status */}
        {hasEmail ? (
          <div className={styles.emailFound}>
            <button
              type="button"
              className={styles.emailToggle}
              onClick={() => setShowEmailPreview(!showEmailPreview)}
            >
              <Mail size={14} />
              <span>Session notes email found</span>
              {showEmailPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showEmailPreview && (
              <div className={styles.emailPreview}>
                {isEditing ? (
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    className={styles.notesTextarea}
                    rows={6}
                  />
                ) : (
                  <pre className={styles.emailText}>{editedNotes}</pre>
                )}
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit3 size={12} />
                  {isEditing ? 'Done' : 'Edit'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className={styles.noEmail}>
            <Mail size={14} />
            No session notes email found
          </p>
        )}

        {/* Hours input */}
        <div className={styles.hoursRow}>
          <label className={styles.hoursLabel}>
            <DollarSign size={14} />
            Billable hours:
          </label>
          <div className={styles.hoursInput}>
            <button
              type="button"
              className={styles.hourBtn}
              onClick={() => setHours(Math.max(0.5, hours - 0.5))}
            >
              −
            </button>
            <span className={styles.hoursValue}>{hours}</span>
            <button
              type="button"
              className={styles.hourBtn}
              onClick={() => setHours(hours + 0.5)}
            >
              +
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {hasEmail ? (
            <button
              type="button"
              onClick={handleConfirm}
              className={styles.confirmBtn}
              disabled={isConfirming}
            >
              <Check size={14} />
              {isConfirming ? 'Saving...' : 'Confirm & Add'}
            </button>
          ) : (
            <Link
              to={`/client/${notification.clientId}?action=addSession`}
              className={styles.actionBtn}
            >
              <FileText size={14} />
              Add Notes Manually
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function PostCallNotifications() {
  const { notifications, dismissNotification, confirmSessionNotes, isCalendarConnected } = useCalendar();

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
            onConfirm={confirmSessionNotes}
          />
        ))}
      </div>
    </div>
  );
}
