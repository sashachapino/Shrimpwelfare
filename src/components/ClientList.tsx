import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Lock, Mail, Calendar as CalendarIcon, DollarSign, Clock, ChevronDown, Archive, Settings, Download, Upload, X, Cloud, CheckCircle2, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useCalendar } from '../contexts/CalendarContext';
import { AllianceIndicator } from './AllianceIndicator';
import { EnneagramIndicator } from './EnneagramIndicator';
import { UpcomingCalls } from './UpcomingCalls';
import { PostCallNotifications } from './PostCallNotifications';
import { downloadBackup, restoreFromBackup, isElectron, getDropboxBackupPath, listDropboxBackups, restoreFromDropboxBackup } from '../utils/storage';
import { ShrimpIcon } from './ShrimpIcon';
import type { Client } from '../types';
import styles from './ClientList.module.css';

function ClientCard({ client }: { client: Client }) {
  return (
    <Link
      to={`/client/${client.id}`}
      className={`card card-hover ${styles.clientCard}`}
    >
      <div className={styles.clientMain}>
        <div className={styles.clientInfo}>
          <h3 className={styles.clientName}>{client.name}</h3>
          <div className={styles.clientMeta}>
            {client.email && (
              <span className={styles.metaItem}>
                <Mail size={14} />
                {client.email}
              </span>
            )}
            <span className={styles.metaItem}>
              <CalendarIcon size={14} />
              {client.sessionsCompleted} sessions
            </span>
            {(client.unpaidHours ?? 0) > 0 && (
              <span className={`${styles.metaItem} ${styles.unpaid}`}>
                <Clock size={14} />
                {client.unpaidHours}h unpaid
                {(client.hourlyRate ?? 0) > 0 && (
                  <> (${((client.unpaidHours ?? 0) * (client.hourlyRate ?? 0)).toFixed(0)})</>
                )}
              </span>
            )}
          </div>
        </div>
        <div className={styles.indicators}>
          <EnneagramIndicator
            type={client.enneagramType ?? '?'}
            secondary={client.enneagramSecondary ?? null}
            size="sm"
          />
          <AllianceIndicator value={client.allianceStrength} size="sm" />
        </div>
      </div>
      {client.currentQuestions && (
        <p className={styles.questions}>
          <strong>Current questions:</strong> {client.currentQuestions.slice(0, 100)}
          {client.currentQuestions.length > 100 && '...'}
        </p>
      )}
    </Link>
  );
}

export function ClientList() {
  const { clients, lock, password, reloadClients, updateClient } = useApp();
  const { upcomingEvents, isCalendarConnected, isLoading: calendarLoading, connectCalendar, refreshEvents } = useCalendar();
  const [search, setSearch] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const scrollToCalendar = () => {
    calendarRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBackup = async () => {
    try {
      await downloadBackup();
      setBackupStatus('Backup downloaded! Save it to your Dropbox folder for cloud backup.');
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (err) {
      setBackupStatus('Failed to create backup');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !password) return;

    setRestoreError(null);
    try {
      await restoreFromBackup(file, password);
      await reloadClients();
      setShowSettings(false);
      setBackupStatus('Backup restored successfully!');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore backup');
    }
    // Reset file input
    e.target.value = '';
  };

  // Filter out archived clients
  const nonArchivedClients = useMemo(() => {
    return clients.filter(c => (c.status ?? 'active') !== 'archived');
  }, [clients]);

  const archivedCount = useMemo(() => {
    return clients.filter(c => c.status === 'archived').length;
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return nonArchivedClients;
    const query = search.toLowerCase();
    return nonArchivedClients.filter(
      client =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
    );
  }, [nonArchivedClients, search]);

  const { activeClients, occasionalClients } = useMemo(() => {
    const active = filteredClients
      .filter(c => (c.status ?? 'active') === 'active')
      .sort((a, b) => a.name.localeCompare(b.name));
    const occasional = filteredClients
      .filter(c => c.status === 'occasional')
      .sort((a, b) => a.name.localeCompare(b.name));
    return { activeClients: active, occasionalClients: occasional };
  }, [filteredClients]);

  const unpaidSummary = useMemo(() => {
    const clientsWithUnpaid = nonArchivedClients.filter(c => (c.unpaidHours ?? 0) > 0);
    const totalHours = clientsWithUnpaid.reduce((sum, c) => sum + (c.unpaidHours ?? 0), 0);
    const totalAmount = clientsWithUnpaid.reduce(
      (sum, c) => sum + (c.unpaidHours ?? 0) * (c.hourlyRate ?? 0),
      0
    );
    return { clientsWithUnpaid, totalHours, totalAmount };
  }, [nonArchivedClients]);

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <ShrimpIcon size={36} className={styles.shrimpIcon} />
          <h1>Clients</h1>
          <span className={styles.count}>{nonArchivedClients.length}</span>
          {unpaidSummary.totalAmount > 0 && (
            <button
              type="button"
              className={styles.unpaidBadge}
              onClick={scrollToSummary}
              title="View unpaid summary"
            >
              <DollarSign size={14} />
              {unpaidSummary.totalAmount.toFixed(0)}
              <ChevronDown size={14} />
            </button>
          )}
          {isCalendarConnected && upcomingEvents.length > 0 && (
            <button
              type="button"
              className={styles.calendarBadge}
              onClick={scrollToCalendar}
              title="View upcoming calls"
            >
              <CalendarIcon size={14} />
              {upcomingEvents.length}
              <ChevronDown size={14} />
            </button>
          )}
        </div>
        <div className={styles.actions}>
          {!isCalendarConnected ? (
            <button
              onClick={connectCalendar}
              className={`btn-ghost ${styles.calendarSyncBtn}`}
              title="Connect Google Calendar"
              disabled={calendarLoading}
            >
              <CalendarIcon size={18} />
              <Plus size={12} className={styles.calendarPlusIcon} />
            </button>
          ) : (
            <button
              onClick={() => refreshEvents()}
              className={`btn-ghost ${styles.calendarSyncBtn} ${styles.connected}`}
              title="Refresh calendar"
              disabled={calendarLoading}
            >
              <RefreshCw size={18} className={calendarLoading ? styles.spinning : ''} />
            </button>
          )}
          {archivedCount > 0 && (
            <Link to="/archived" className={`btn-ghost ${styles.archiveBtn}`} title="View archived clients">
              <Archive size={18} />
              <span className={styles.archiveCount}>{archivedCount}</span>
            </Link>
          )}
          <Link to="/client/new" className={`btn-accent ${styles.addBtn}`}>
            <Plus size={18} />
            Add Client
          </Link>
          <button onClick={() => setShowSettings(true)} className={`btn-ghost ${styles.settingsBtn}`} title="Settings">
            <Settings size={18} />
          </button>
          <button onClick={lock} className={`btn-ghost ${styles.lockBtn}`} title="Lock">
            <Lock size={18} />
          </button>
        </div>
      </header>

      <div className={styles.searchWrapper}>
        <Search className={styles.searchIcon} size={18} />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <PostCallNotifications />

      {nonArchivedClients.length === 0 ? (
        <div className={styles.empty}>
          <Users className={styles.emptyIcon} />
          <h3>No clients yet</h3>
          <p>Add your first client to get started</p>
          <Link to="/client/new" className="btn-accent">
            <Plus size={18} />
            Add Client
          </Link>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className={styles.empty}>
          <Search className={styles.emptyIcon} />
          <h3>No results</h3>
          <p>No clients match "{search}"</p>
        </div>
      ) : (
        <>
          {/* Active Clients */}
          {activeClients.length > 0 && (
            <div className={styles.list}>
              {activeClients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}

          {/* Occasional Clients */}
          {occasionalClients.length > 0 && (
            <div className={styles.occasionalSection}>
              <h2 className={styles.sectionLabel}>Occasional</h2>
              <div className={styles.list}>
                {occasionalClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Upcoming Calls - at bottom, collapsible */}
      <div ref={calendarRef}>
        <UpcomingCalls collapsible />
      </div>

      {/* Unpaid Summary - at bottom */}
      {unpaidSummary.totalHours > 0 && (
        <div ref={summaryRef} className={styles.summaryCard}>
          <button
            type="button"
            className={styles.summaryHeader}
            onClick={() => setShowSummary(!showSummary)}
          >
            <div className={styles.summaryTitle}>
              <DollarSign size={18} />
              <span>Unpaid Summary</span>
            </div>
            <div className={styles.summaryTotal}>
              ${unpaidSummary.totalAmount.toFixed(2)}
            </div>
          </button>
          {showSummary && (
            <div className={styles.summaryContent}>
              <div className={styles.summaryStats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Hours</span>
                  <span className={styles.statValue}>{unpaidSummary.totalHours}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Clients</span>
                  <span className={styles.statValue}>{unpaidSummary.clientsWithUnpaid.length}</span>
                </div>
              </div>
              <div className={styles.summaryList}>
                {unpaidSummary.clientsWithUnpaid.map(client => (
                  <div key={client.id} className={styles.summaryItem}>
                    <Link to={`/client/${client.id}`} className={styles.summaryItemLink}>
                      <span className={styles.summaryName}>{client.name}</span>
                      <span className={styles.summaryHours}>{client.unpaidHours}h</span>
                      <span className={styles.summaryAmount}>
                        ${((client.unpaidHours ?? 0) * (client.hourlyRate ?? 0)).toFixed(2)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className={styles.markPaidBtn}
                      onClick={() => updateClient(client.id, { unpaidHours: 0 })}
                      title="Mark as paid"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backup status toast */}
      {backupStatus && (
        <div className={styles.toast}>
          {backupStatus}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Settings</h2>
              <button onClick={() => setShowSettings(false)} className={styles.modalClose}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalContent}>
              <div className={styles.settingsSection}>
                <h3>Backup & Restore</h3>
                <p className={styles.settingsDescription}>
                  Your data is encrypted locally. Export a backup file to save to Dropbox
                  or another cloud folder for safekeeping.
                </p>

                <div className={styles.backupActions}>
                  <button onClick={handleBackup} className="btn-accent">
                    <Download size={18} />
                    Download Backup
                  </button>
                  <button onClick={handleRestoreClick} className="btn-secondary">
                    <Upload size={18} />
                    Restore from Backup
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFile}
                    style={{ display: 'none' }}
                  />
                </div>

                {restoreError && (
                  <p className={styles.restoreError}>{restoreError}</p>
                )}

                <p className={styles.backupNote}>
                  Backup files are fully encrypted with your password.
                  Safe to store in Dropbox, Google Drive, etc.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
