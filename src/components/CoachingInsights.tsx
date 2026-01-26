import { useState } from 'react';
import { Sparkles, Key, Loader2, AlertCircle, Shield, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getCoachingInsights, getAnonymizationPreview, type CoachingInsight, type AnonymizationPreview } from '../utils/claude';
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
  const [preview, setPreview] = useState<AnonymizationPreview | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const handleSaveApiKey = async () => {
    if (apiKeyInput.trim()) {
      await setAnthropicApiKey(apiKeyInput.trim());
      setShowApiKeyInput(false);
      setApiKeyInput('');
    }
  };

  const handleShowPreview = () => {
    if (!anthropicApiKey) {
      setShowApiKeyInput(true);
      return;
    }
    const previewData = getAnonymizationPreview(client);
    setPreview(previewData);
  };

  const handleConfirmSend = async () => {
    if (!anthropicApiKey || !preview) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getCoachingInsights(anthropicApiKey, preview.anonymizedData);
      setInsights(result);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get insights');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
  };

  if (showApiKeyInput) {
    return (
      <div className={styles.container}>
        <div className={styles.apiKeyPrompt}>
          <Key className={styles.keyIcon} />
          <h3>Connect Claude</h3>
          <p>Enter your Anthropic API key to enable AI-powered coaching questions</p>
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

  if (preview) {
    return (
      <div className={styles.container}>
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <Shield size={20} />
            <h3>Review Anonymized Data</h3>
          </div>

          <div className={styles.previewWarning}>
            <p>
              <strong>Before sending:</strong> Review the anonymized data below.
              Confirm no identifying information remains.
            </p>
            <p className={styles.retentionNote}>
              <strong>Data retention:</strong> Anthropic may retain API data for up to 30 days
              for safety monitoring. They do not use API data for training.
              {' '}<a href="https://support.anthropic.com/en/articles/7996866-how-long-do-you-store-personal-data" target="_blank" rel="noopener noreferrer">Learn more</a>
            </p>
          </div>

          {preview.anonymizedData.allReplacements.length > 0 && (
            <div className={styles.replacementsList}>
              <h4>Automatic replacements made:</h4>
              <ul>
                {preview.anonymizedData.allReplacements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.previewToggle}>
            <button
              onClick={() => setShowFullPreview(!showFullPreview)}
              className={styles.toggleBtn}
            >
              <Eye size={16} />
              {showFullPreview ? 'Hide' : 'Show'} full prompt
              {showFullPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showFullPreview && (
            <div className={styles.fullPreview}>
              <pre>{preview.promptPreview}</pre>
            </div>
          )}

          <div className={styles.previewActions}>
            <button onClick={handleConfirmSend} className="btn-accent">
              Confirm & Send
            </button>
            <button onClick={handleCancel} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>Generating coaching questions...</p>
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
          <button onClick={handleShowPreview} className="btn-secondary">
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
            Coaching Questions
          </h2>
          <button onClick={handleShowPreview} className={styles.refreshBtn}>
            Refresh
          </button>
        </div>

        <div className={styles.insightSection}>
          <h3 className={styles.perspectiveTitle}>
            Diana Chapman
            <span className={styles.perspectiveSubtitle}>Conscious Leadership</span>
          </h3>
          <ul>
            {insights.dianaChapman.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>

        <div className={styles.insightSection}>
          <h3 className={styles.perspectiveTitle}>
            Bruce Tift
            <span className={styles.perspectiveSubtitle}>Developmental/Relational</span>
          </h3>
          <ul>
            {insights.bruceTift.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>

        <div className={styles.insightSection}>
          <h3 className={styles.perspectiveTitle}>
            Fritz Perls
            <span className={styles.perspectiveSubtitle}>Gestalt</span>
          </h3>
          <ul>
            {insights.fritzPerls.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={handleShowPreview} className={styles.getInsightsBtn}>
        <Sparkles size={18} />
        Get Coaching Questions
      </button>
      <p className={styles.description}>
        AI-generated questions from Diana Chapman, Bruce Tift, and Fritz Perls perspectives.
        Data is anonymized before sending.
      </p>
    </div>
  );
}
