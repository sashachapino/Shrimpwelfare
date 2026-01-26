import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Lock, Mail, Calendar, AlertCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { AllianceIndicator } from './AllianceIndicator';
import styles from './ClientList.module.css';

export function ClientList() {
  const { clients, lock } = useApp();
  const [search, setSearch] = useState('');

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const query = search.toLowerCase();
    return clients.filter(
      client =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
    );
  }, [clients, search]);

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredClients]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Clients</h1>
          <span className={styles.count}>{clients.length}</span>
        </div>
        <div className={styles.actions}>
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

      {clients.length === 0 ? (
        <div className={styles.empty}>
          <Users className={styles.emptyIcon} />
          <h3>No clients yet</h3>
          <p>Add your first client to get started</p>
          <Link to="/client/new" className="btn-accent">
            <Plus size={18} />
            Add Client
          </Link>
        </div>
      ) : sortedClients.length === 0 ? (
        <div className={styles.empty}>
          <Search className={styles.emptyIcon} />
          <h3>No results</h3>
          <p>No clients match "{search}"</p>
        </div>
      ) : (
        <div className={styles.list}>
          {sortedClients.map((client) => (
            <Link
              to={`/client/${client.id}`}
              key={client.id}
              className={`card card-hover ${styles.clientCard}`}
            >
              <div className={styles.clientMain}>
                <div className={styles.clientInfo}>
                  <h3 className={styles.clientName}>{client.name}</h3>
                  <div className={styles.clientMeta}>
                    <span className={styles.metaItem}>
                      <Mail size={14} />
                      {client.email}
                    </span>
                    <span className={styles.metaItem}>
                      <Calendar size={14} />
                      {client.sessionsCompleted} sessions
                    </span>
                    {client.unpaidSessions > 0 && (
                      <span className={`${styles.metaItem} ${styles.unpaid}`}>
                        <AlertCircle size={14} />
                        {client.unpaidSessions} unpaid
                      </span>
                    )}
                  </div>
                </div>
                <AllianceIndicator value={client.allianceStrength} size="sm" />
              </div>
              {client.currentQuestions && (
                <p className={styles.questions}>
                  <strong>Current questions:</strong> {client.currentQuestions.slice(0, 100)}
                  {client.currentQuestions.length > 100 && '...'}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
