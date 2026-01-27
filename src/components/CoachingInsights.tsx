import { useState, Component, type ReactNode } from 'react';
import { Sparkles, Key, Loader2, AlertCircle, Shield, Eye, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  getCoachingInsights,
  getAnonymizationPreview,
  getPlotSummary,
  getPlotSummaryPreview,
  type CoachingInsight,
  type AnonymizationPreview
} from '../utils/claude';
import type { Client } from '../types';
import styles from './CoachingInsights.module.css';

// Error boundary to catch render errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CoachingInsightsErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CoachingInsights error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.error}>
            <AlertCircle size={20} />
            <p>Something went wrong: {this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-secondary"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type ActiveFeature = 'questions' | 'plotSummary' | null;

interface CoachingInsightsProps {
  client: Client;
}

// Wrapper with error boundary
export function CoachingInsights({ client }: CoachingInsightsProps) {
  return (
    <CoachingInsightsErrorBoundary>
      <CoachingInsightsInner client={client} />
    </CoachingInsightsErrorBoundary>
  );
}

function CoachingInsightsInner({ client }: CoachingInsightsProps) {
  const { anthropicApiKey, setAnthropicApiKey } = useApp();
  const [insights, setInsights] = useState<CoachingInsight | null>(null);
  const [plotSummary, setPlotSummary] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>(null);
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
      // After saving key, show preview for the intended feature
      if (activeFeature) {
        try {
          const previewData = activeFeature === 'plotSummary'
            ? getPlotSummaryPreview(client)
            : getAnonymizationPreview(client);
          setPreview(previewData);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate preview');
        }
      }
    }
  };

  const handleShowPreview = (feature: ActiveFeature) => {
    if (!anthropicApiKey) {
      setActiveFeature(feature);
      setShowApiKeyInput(true);
      return;
    }
    setActiveFeature(feature);
    setError(null);
    try {
      const previewData = feature === 'plotSummary'
        ? getPlotSummaryPreview(client)
        : getAnonymizationPreview(client);
      setPreview(previewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    }
  };

  const handleConfirmSend = async () => {
    if (!anthropicApiKey || !preview || !activeFeature) return;

    setLoading(true);
    setError(null);

    try {
      if (activeFeature === 'plotSummary') {
        const result = await getPlotSummary(anthropicApiKey, preview.anonymizedData);
        setPlotSummary(result);
      } else {
        const result = await getCoachingInsights(anthropicApiKey, preview.anonymizedData);
        setInsights(result);
      }
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setActiveFeature(null);
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
            <button type="button" onClick={handleSaveApiKey} className="btn-accent" disabled={!apiKeyInput.trim()}>
              Save Key
            </button>
            <button type="button" onClick={() => setShowApiKeyInput(false)} className="btn-ghost">
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
    const replacements = preview.anonymizedData?.allReplacements ?? [];

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

          {replacements.length > 0 && (
            <div className={styles.replacementsList}>
              <h4>Automatic replacements made:</h4>
              <ul>
                {replacements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.previewToggle}>
            <button
              type="button"
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
              <pre>{preview.promptPreview ?? ''}</pre>
            </div>
          )}

          <div className={styles.previewActions}>
            <button type="button" onClick={handleConfirmSend} className="btn-accent">
              Confirm & Send
            </button>
            <button type="button" onClick={handleCancel} className="btn-ghost">
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
          <p>{activeFeature === 'plotSummary' ? 'Writing plot summary...' : 'Generating coaching questions...'}</p>
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
          <button type="button" onClick={() => handleShowPreview(activeFeature)} className="btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show results if we have either insights or plot summary
  if (insights || plotSummary) {
    const dianaQuestions = insights?.dianaChapman ?? [];
    const bruceQuestions = insights?.bruceTift ?? [];
    const fritzQuestions = insights?.fritzPerls ?? [];
    const summaryParagraphs = typeof plotSummary === 'string' ? plotSummary.split('\n\n') : [];

    return (
      <div className={styles.container}>
        {/* Plot Summary Display */}
        {plotSummary && (
          <>
            <div className={styles.header}>
              <h2>
                <BookOpen size={20} />
                Plot Summary
              </h2>
              <button type="button" onClick={() => handleShowPreview('plotSummary')} className={styles.refreshBtn}>
                Refresh
              </button>
            </div>
            <div className={styles.plotSummary}>
              {summaryParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </>
        )}

        {/* Coaching Questions Display */}
        {insights && (
          <>
            <div className={styles.header}>
              <h2>
                <Sparkles size={20} />
                Coaching Questions
              </h2>
              <button type="button" onClick={() => handleShowPreview('questions')} className={styles.refreshBtn}>
                Refresh
              </button>
            </div>

            <div className={styles.insightSection}>
              <h3 className={styles.perspectiveTitle}>
                Diana Chapman
                <span className={styles.perspectiveSubtitle}>Conscious Leadership</span>
              </h3>
              <ul>
                {dianaQuestions.map((q, i) => (
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
                {bruceQuestions.map((q, i) => (
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
                {fritzQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Show button for the other feature if we only have one */}
        <div className={styles.additionalActions}>
          {!plotSummary && (
            <button type="button" onClick={() => handleShowPreview('plotSummary')} className={styles.secondaryActionBtn}>
              <BookOpen size={16} />
              Get Plot Summary
            </button>
          )}
          {!insights && (
            <button type="button" onClick={() => handleShowPreview('questions')} className={styles.secondaryActionBtn}>
              <Sparkles size={16} />
              Get Coaching Questions
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttonGroup}>
        <button type="button" onClick={() => handleShowPreview('questions')} className={styles.getInsightsBtn}>
          <Sparkles size={18} />
          Coaching Questions
        </button>
        <button type="button" onClick={() => handleShowPreview('plotSummary')} className={styles.getInsightsBtn}>
          <BookOpen size={18} />
          Plot Summary
        </button>
      </div>
      <p className={styles.description}>
        AI-powered features. Data is anonymized before sending.
      </p>
    </div>
  );
}
