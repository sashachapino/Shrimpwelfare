import { useState } from 'react';
import { Sparkles, Key, Loader2, AlertCircle, MessageCircle, Eye, TrendingUp, ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getCoachingInsights, type CoachingInsight } from '../utils/claude';
import type { Client } from '../types';
import styles from './CoachingInsights.module.css';

interface CoachingInsightsProps {
  client: Client;
}

export function CoachingInsights({ client }: CoachingInsightsProps) {
  const { anthropicApiKey, setAnthropicApiKey } = useApp();
  const [insights, setInsights] = useState<CoachingInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleSaveApiKey = async () => {
    if (apiKeyInput.trim()) {
      await setAnthropicApiKey(apiKeyInput.trim());
      setShowApiKeyInput(false);
      setApiKeyInput('');
    }
  };

  const handleGetInsights = async () => {
    if (!anthropicApiKey) {
      setShowApiKeyInput(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getCoachingInsights(anthropicApiKey, client);
      setInsights(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get insights');
    } finally {
      setLoading(false);
    }
  };

  if (showApiKeyInput) {
    return (
      <div className={styles.container}>
        <div className={styles.apiKeyPrompt}>
          <Key className={styles.keyIcon} />
          <h3>Connect Claude</h3>
          <p>Enter your Anthropic API key to enable AI-powered coaching insights</p>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            className={styles.apiKeyInput}
          />
          <div className={styles.apiKeyActions}>
            <button onClick={handleSaveApiKey} className="btn-accent" disabled={!apiKeyInput.trim()}>
              Save Key
            </button>
            <button onClick={() => setShowApiKeyInput(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
          <p className={styles.hint}>
            Get your API key at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>Diana is reviewing the notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <AlertCircle size={20} />
          <p>{error}</p>
          <button onClick={handleGetInsights} className="btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (insights) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>
            <Sparkles size={20} />
            Diana's Perspective
          </h2>
          <button onClick={handleGetInsights} className={styles.refreshBtn}>
            Refresh
          </button>
        </div>

        <div className={styles.insightSection}>
          <h3>
            <MessageCircle size={16} />
            Leading Questions
          </h3>
          <ul>
            {insights.leadingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>

        <div className={styles.insightSection}>
          <h3>
            <Eye size={16} />
            Blind Spots
          </h3>
          <ul>
            {insights.blindSpots.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>

        <div className={styles.insightSection}>
          <h3>
            <TrendingUp size={16} />
            Patterns
          </h3>
          <ul>
            {insights.patterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>

        <div className={styles.insightSection}>
          <h3>
            <ArrowRight size={16} />
            Next Steps
          </h3>
          <ul>
            {insights.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={handleGetInsights} className={styles.getInsightsBtn}>
        <Sparkles size={18} />
        Get Diana's Perspective
      </button>
      <p className={styles.description}>
        AI-powered coaching insights inspired by Diana Chapman's approach
      </p>
    </div>
  );
}
