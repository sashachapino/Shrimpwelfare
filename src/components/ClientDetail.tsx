import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Calendar,
  Mail,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { AllianceIndicator } from './AllianceIndicator';
import { EnneagramIndicator } from './EnneagramIndicator';
import { SessionNotes } from './SessionNotes';
import type { Client, SessionNote, EnneagramType, EnneagramWing, ClientStatus } from '../types';
import styles from './ClientDetail.module.css';

const emptyClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  email: '',
  enneagramType: '?',
  enneagramWing: null,
  status: 'active',
  sessionsCompleted: 0,
  unpaidHours: 0,
  hourlyRate: 0,
  sessionNotes: [],
  overallNotes: '',
  currentQuestions: '',
  allianceStrength: 5,
};

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, addClient, updateClient, deleteClient } = useApp();

  const isNew = id === 'new';
  const existingClient = id && !isNew ? getClient(id) : null;

  const [formData, setFormData] = useState<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>>(
    existingClient || emptyClient
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    sessions: true,
    notes: true,
    questions: true,
  });
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionNumber, setNewSessionNumber] = useState(1);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (existingClient) {
      setFormData(existingClient);
    }
  }, [existingClient]);

  if (!isNew && !existingClient) {
    return (
      <div className={styles.notFound}>
        <h2>Client not found</h2>
        <Link to="/" className="btn-primary">
          Back to clients
        </Link>
      </div>
    );
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isNew) {
        await addClient(formData);
      } else if (id) {
        await updateClient(id, formData);
      }
      navigate('/');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (id && !isNew) {
      await deleteClient(id);
      navigate('/');
    }
  };

  const handleAddSession = () => {
    const newSession: SessionNote = {
      id: crypto.randomUUID(),
      sessionNumber: newSessionNumber,
      date: newSessionDate,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFormData((prev) => ({
      ...prev,
      sessionsCompleted: Math.max(prev.sessionsCompleted, newSessionNumber),
      sessionNotes: [...prev.sessionNotes, newSession],
    }));
    setShowAddSession(false);
    // Reset for next time, suggest next session number
    setNewSessionNumber(Math.max(formData.sessionsCompleted, newSessionNumber) + 1);
    setNewSessionDate(new Date().toISOString().split('T')[0]);
  };

  const handleUpdateSessionNote = (sessionId: string, updates: Partial<SessionNote>) => {
    setFormData((prev) => ({
      ...prev,
      sessionNotes: prev.sessionNotes.map((s) =>
        s.id === sessionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      ),
    }));
  };

  const handleDeleteSession = (sessionId: string) => {
    setFormData((prev) => ({
      ...prev,
      sessionsCompleted: Math.max(0, prev.sessionsCompleted - 1),
      sessionNotes: prev.sessionNotes.filter((s) => s.id !== sessionId),
    }));
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="/" className={styles.backBtn}>
          <ArrowLeft size={20} />
          Back
        </Link>
        <h1>{isNew ? 'New Client' : formData.name || 'Client'}</h1>
      </header>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Basic Info */}
        <section className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Basic Information</h2>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Client name"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email">
                <Mail size={14} style={{ marginRight: 4 }} />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="client@email.com"
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="sessionsCompleted">
                <Calendar size={14} style={{ marginRight: 4 }} />
                Sessions Completed
              </label>
              <input
                id="sessionsCompleted"
                type="number"
                min="0"
                value={formData.sessionsCompleted}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sessionsCompleted: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="unpaidHours">Unpaid Hours</label>
              <input
                id="unpaidHours"
                type="number"
                min="0"
                step="0.5"
                value={formData.unpaidHours || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    unpaidHours: e.target.value === '' ? 0 : parseFloat(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="hourlyRate">Hourly Rate ($)</label>
              <input
                id="hourlyRate"
                type="number"
                min="0"
                step="1"
                value={formData.hourlyRate || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    hourlyRate: e.target.value === '' ? 0 : parseFloat(e.target.value),
                  }))
                }
              />
            </div>
            {formData.unpaidHours > 0 && formData.hourlyRate > 0 && (
              <div className={styles.field}>
                <label>Amount Owed</label>
                <div className={styles.amountOwed}>
                  ${(formData.unpaidHours * formData.hourlyRate).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label>Alliance Strength</label>
            <div className={styles.allianceWrapper}>
              <AllianceIndicator
                value={formData.allianceStrength}
                size="lg"
                showLabel={false}
                onChange={(value) => setFormData((prev) => ({ ...prev, allianceStrength: value }))}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Enneagram Type</label>
            <EnneagramIndicator
              type={formData.enneagramType}
              wing={formData.enneagramWing}
              size="lg"
              onChange={(type: EnneagramType, wing: EnneagramWing) =>
                setFormData((prev) => ({ ...prev, enneagramType: type, enneagramWing: wing }))
              }
            />
          </div>

          <div className={styles.field}>
            <label>Client Status</label>
            <div className={styles.statusSelector}>
              {(['active', 'occasional', 'archived'] as ClientStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.statusBtn} ${formData.status === status ? styles.selected : ''} ${styles[status]}`}
                  onClick={() => setFormData((prev) => ({ ...prev, status }))}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Session Notes */}
        <section className={`card ${styles.section}`}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => toggleSection('sessions')}
          >
            <h2 className={styles.sectionTitle}>
              <FileText size={18} />
              Session Notes
              <span className={styles.badge}>{formData.sessionNotes.length}</span>
            </h2>
            {expandedSections.sessions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.sessions && (
            <div className={styles.sectionContent}>
              <SessionNotes
                sessions={formData.sessionNotes}
                onUpdate={handleUpdateSessionNote}
                onDelete={handleDeleteSession}
              />
              {showAddSession ? (
                <div className={styles.addSessionForm}>
                  <div className={styles.addSessionFields}>
                    <div className={styles.field}>
                      <label htmlFor="newSessionNumber">Session #</label>
                      <input
                        id="newSessionNumber"
                        type="number"
                        min="1"
                        value={newSessionNumber}
                        onChange={(e) => setNewSessionNumber(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="newSessionDate">Date</label>
                      <input
                        id="newSessionDate"
                        type="date"
                        value={newSessionDate}
                        onChange={(e) => setNewSessionDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles.addSessionActions}>
                    <button
                      type="button"
                      className="btn-accent"
                      onClick={handleAddSession}
                    >
                      <Plus size={18} />
                      Add
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setShowAddSession(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`btn-secondary ${styles.addSessionBtn}`}
                  onClick={() => {
                    setNewSessionNumber(formData.sessionsCompleted + 1);
                    setShowAddSession(true);
                  }}
                >
                  <Plus size={18} />
                  Add Session
                </button>
              )}
            </div>
          )}
        </section>

        {/* Overall Notes */}
        <section className={`card ${styles.section}`}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => toggleSection('notes')}
          >
            <h2 className={styles.sectionTitle}>
              <FileText size={18} />
              Overall Notes
            </h2>
            {expandedSections.notes ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.notes && (
            <div className={styles.sectionContent}>
              <textarea
                value={formData.overallNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, overallNotes: e.target.value }))}
                placeholder="General observations, patterns, background information..."
                rows={6}
              />
            </div>
          )}
        </section>

        {/* Current Questions */}
        <section className={`card ${styles.section}`}>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => toggleSection('questions')}
          >
            <h2 className={styles.sectionTitle}>
              <HelpCircle size={18} />
              Current Questions
            </h2>
            {expandedSections.questions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.questions && (
            <div className={styles.sectionContent}>
              <textarea
                value={formData.currentQuestions}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currentQuestions: e.target.value }))
                }
                placeholder="Things you're wondering about, areas to explore, hypotheses..."
                rows={4}
              />
            </div>
          )}
        </section>

        {/* Actions */}
        <div className={styles.actions}>
          <button type="submit" className={`btn-primary ${styles.saveBtn}`} disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Client'}
          </button>

          {!isNew && (
            <>
              {showDeleteConfirm ? (
                <div className={styles.deleteConfirm}>
                  <span>Delete this client?</span>
                  <button type="button" className="btn-danger" onClick={handleDelete}>
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`btn-ghost ${styles.deleteBtn}`}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
}
