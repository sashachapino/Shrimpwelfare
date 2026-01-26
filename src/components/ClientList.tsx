import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Lock, Mail, Calendar, DollarSign, Clock, ChevronDown, Archive } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { AllianceIndicator } from './AllianceIndicator';
import { EnneagramIndicator } from './EnneagramIndicator';
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
              <Calendar size={14} />
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
            wing={client.enneagramWing ?? null}
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
  const { clients, lock } = useApp();
  const [search, setSearch] = useState('');
  const [showSummary, setShowSummary] = useState(true);
  const summaryRef = useRef<HTMLDivElement>(null);

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
        </div>
        <div className={styles.actions}>
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
                  <Link
                    key={client.id}
                    to={`/client/${client.id}`}
                    className={styles.summaryItem}
                  >
                    <span className={styles.summaryName}>{client.name}</span>
                    <span className={styles.summaryHours}>{client.unpaidHours}h</span>
                    <span className={styles.summaryAmount}>
                      ${((client.unpaidHours ?? 0) * (client.hourlyRate ?? 0)).toFixed(2)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
