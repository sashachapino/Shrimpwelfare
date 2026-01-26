import { useState } from 'react';
import { Calendar, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SessionNote } from '../types';
import styles from './SessionNotes.module.css';

interface SessionNotesProps {
  sessions: SessionNote[];
  onUpdate: (sessionId: string, updates: Partial<SessionNote>) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionNotes({ sessions, onUpdate, onDelete }: SessionNotesProps) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set(sessions.slice(-2).map((s) => s.id))
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (sessions.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No session notes yet. Add a session to start recording notes.</p>
      </div>
    );
  }

  // Sort sessions by date (most recent first)
  const sortedSessions = [...sessions].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={styles.list}>
      {sortedSessions.map((session) => (
        <div key={session.id} className={styles.session}>
          <button
            type="button"
            className={styles.sessionHeader}
            onClick={() => toggleSession(session.id)}
          >
            <div className={styles.sessionInfo}>
              <span className={styles.sessionNumber}>Session {session.sessionNumber}</span>
              <span className={styles.sessionDate}>
                <Calendar size={14} />
                {formatDate(session.date)}
              </span>
            </div>
            {expandedSessions.has(session.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expandedSessions.has(session.id) && (
            <div className={styles.sessionContent}>
              <div className={styles.dateField}>
                <label>Date</label>
                <input
                  type="date"
                  value={session.date}
                  onChange={(e) => onUpdate(session.id, { date: e.target.value })}
                  className={styles.dateInput}
                />
              </div>
              <textarea
                value={session.notes}
                onChange={(e) => onUpdate(session.id, { notes: e.target.value })}
                placeholder="Session notes, observations, key moments, homework given..."
                rows={5}
              />
              <div className={styles.sessionFooter}>
                {deleteConfirm === session.id ? (
                  <div className={styles.deleteConfirm}>
                    <span>Delete this session?</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        onDelete(session.id);
                        setDeleteConfirm(null);
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => setDeleteConfirm(session.id)}
                  >
                    <Trash2 size={14} />
                    Delete session
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
