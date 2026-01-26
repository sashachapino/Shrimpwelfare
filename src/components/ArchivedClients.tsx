import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Archive, Mail, Calendar, RotateCcw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { AllianceIndicator } from './AllianceIndicator';
import { EnneagramIndicator } from './EnneagramIndicator';
import type { Client } from '../types';
import styles from './ArchivedClients.module.css';

export function ArchivedClients() {
  const { clients, updateClient } = useApp();
  const [search, setSearch] = useState('');

  const archivedClients = useMemo(() => {
    return clients.filter(c => c.status === 'archived');
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return archivedClients;
    const query = search.toLowerCase();
    return archivedClients.filter(
      client =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
    );
  }, [archivedClients, search]);

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredClients]);

  const handleRestore = (client: Client, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateClient(client.id, { status: 'active' });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <Link to="/" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <h1>Archived Clients</h1>
          <span className={styles.count}>{archivedClients.length}</span>
        </div>
      </header>

      {archivedClients.length > 0 && (
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <input
            type="text"
            placeholder="Search archived clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      )}

      {archivedClients.length === 0 ? (
        <div className={styles.empty}>
          <Archive className={styles.emptyIcon} />
          <h3>No archived clients</h3>
          <p>Clients you archive will appear here</p>
          <Link to="/" className="btn-accent">
            <ArrowLeft size={18} />
            Back to Clients
          </Link>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className={styles.empty}>
          <Search className={styles.emptyIcon} />
          <h3>No results</h3>
          <p>No archived clients match "{search}"</p>
        </div>
      ) : (
        <div className={styles.list}>
          {sortedClients.map((client) => (
            <div key={client.id} className={styles.clientCard}>
              <Link
                to={`/client/${client.id}`}
                className={styles.clientLink}
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
              </Link>
              <button
                className={styles.restoreBtn}
                onClick={(e) => handleRestore(client, e)}
                title="Restore to active clients"
              >
                <RotateCcw size={16} />
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
