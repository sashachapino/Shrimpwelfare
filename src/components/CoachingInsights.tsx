import { useState } from 'react';
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

type ActiveFeature = 'questions' | 'plotSummary' | null;

interface CoachingInsightsProps {
  client: Client;
}

// Single component - removed error boundary to simplify debugging
export function CoachingInsights({ client }: CoachingInsightsProps) {
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

  // Direct function - no useCallback to avoid stale closure issues
  const handleShowPreview = (feature: ActiveFeature) => {
    console.log('=== handleShowPreview START ===');
    console.log('Feature:', feature);
    console.log('Has API key:', !!anthropicApiKey);
    console.log('Client:', client?.name);

    if (!anthropicApiKey) {
      console.log('No API key - showing input');
      setActiveFeature(feature);
      setShowApiKeyInput(true);
      console.log('State updated for API key input');
      return;
    }

    try {
      console.log('Generating preview data...');
      const previewData = feature === 'plotSummary'
        ? getPlotSummaryPreview(client)
        : getAnonymizationPreview(client);

      console.log('Preview data generated successfully');

      setActiveFeature(feature);
      setError(null);
      setPreview(previewData);

      // Force browser repaint
      requestAnimationFrame(() => {
        document.body.offsetHeight;
      });

      console.log('=== handleShowPreview END (success) ===');
    } catch (err) {
      console.error('Error in handleShowPreview:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
      console.log('=== handleShowPreview END (error) ===');
    }
  };

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

  const handleConfirmSend = async () => {
    console.log('=== handleConfirmSend START ===');
    console.log('anthropicApiKey:', !!anthropicApiKey);
    console.log('preview:', !!preview);
    console.log('activeFeature:', activeFeature);

    if (!anthropicApiKey || !preview || !activeFeature) {
      console.log('EARLY RETURN - missing:', {
        apiKey: !anthropicApiKey,
        preview: !preview,
        activeFeature: !activeFeature
      });
      return;
    }

    console.log('Setting loading state...');
    setLoading(true);
    setError(null);

    // Force browser repaint - reading offsetHeight triggers reflow
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        document.body.offsetHeight; // Force reflow
        requestAnimationFrame(resolve); // Wait for next frame
      });
    });
    console.log('Forced repaint, now making API call...');

    try {
      console.log('Making API call for:', activeFeature);
      if (activeFeature === 'plotSummary') {
        const result = await getPlotSummary(anthropicApiKey, preview.anonymizedData);
        console.log('Got plot summary result');
        setPlotSummary(result);
      } else {
        const result = await getCoachingInsights(anthropicApiKey, preview.anonymizedData);
        console.log('Got coaching insights result');
        setInsights(result);
      }
      setPreview(null);
      console.log('=== handleConfirmSend END (success) ===');
    } catch (err) {
      console.error('API call error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');
      console.log('=== handleConfirmSend END (error) ===');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setActiveFeature(null);
  };

  // Log current state on every render
  console.log('CoachingInsights RENDER:', {
    showApiKeyInput,
    hasPreview: !!preview,
    loading,
    hasError: !!error,
    hasInsights: !!insights,
    hasPlotSummary: !!plotSummary,
    activeFeature,
    hasApiKey: !!anthropicApiKey
  });

  if (showApiKeyInput) {
    console.log('>>> Rendering: API KEY INPUT state');
    return (
      <div className={styles.container} style={{ border: '3px solid blue' }}>
        <div style={{ background: 'blue', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
          STATE: API KEY INPUT
        </div>
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
    console.log('>>> Rendering: PREVIEW state');
    const replacements = preview.anonymizedData?.allReplacements ?? [];

    return (
      <div className={styles.container} style={{ border: '3px solid green' }}>
        <div style={{ background: 'green', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
          STATE: PREVIEW (has anonymized data ready to send)
        </div>
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
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Confirm & Send button clicked!');
                handleConfirmSend();
              }}
              className="btn-accent"
            >
              Confirm & Send
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked!');
                handleCancel();
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    console.log('>>> Rendering: LOADING state');
    return (
      <div className={styles.container} style={{ border: '3px solid orange' }}>
        <div style={{ background: 'orange', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
          STATE: LOADING (sending to Claude API)
        </div>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>{activeFeature === 'plotSummary' ? 'Writing plot summary...' : 'Generating coaching questions...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('>>> Rendering: ERROR state');
    return (
      <div className={styles.container} style={{ border: '3px solid red' }}>
        <div style={{ background: 'red', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
          STATE: ERROR
        </div>
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
    console.log('>>> Rendering: RESULTS state');
    const defaultPerspective = { vitalMatter: '', questions: [] };
    const diana = insights?.dianaChapman ?? defaultPerspective;
    const bruce = insights?.bruceTift ?? defaultPerspective;
    const jonathan = insights?.jonathanShedler ?? defaultPerspective;
    const genpo = insights?.genpoRoshi ?? defaultPerspective;
    const summaryParagraphs = typeof plotSummary === 'string' ? plotSummary.split('\n\n') : [];

    return (
      <div className={styles.container} style={{ border: '3px solid purple' }}>
        <div style={{ background: 'purple', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
          STATE: RESULTS (showing AI responses)
        </div>
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

        {/* Coaching Insights Display */}
        {insights && (
          <>
            <div className={styles.header}>
              <h2>
                <Sparkles size={20} />
                Coaching Insights
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
              {diana.vitalMatter && (
                <p className={styles.vitalMatter}>{diana.vitalMatter}</p>
              )}
              <ul>
                {(diana.questions ?? []).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className={styles.insightSection}>
              <h3 className={styles.perspectiveTitle}>
                Bruce Tift
                <span className={styles.perspectiveSubtitle}>Developmental/Relational</span>
              </h3>
              {bruce.vitalMatter && (
                <p className={styles.vitalMatter}>{bruce.vitalMatter}</p>
              )}
              <ul>
                {(bruce.questions ?? []).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className={styles.insightSection}>
              <h3 className={styles.perspectiveTitle}>
                Jonathan Shedler
                <span className={styles.perspectiveSubtitle}>Psychodynamic</span>
              </h3>
              {jonathan.vitalMatter && (
                <p className={styles.vitalMatter}>{jonathan.vitalMatter}</p>
              )}
              <ul>
                {(jonathan.questions ?? []).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className={styles.insightSection}>
              <h3 className={styles.perspectiveTitle}>
                Genpo Roshi
                <span className={styles.perspectiveSubtitle}>Big Mind Process</span>
              </h3>
              {genpo.vitalMatter && (
                <p className={styles.vitalMatter}>{genpo.vitalMatter}</p>
              )}
              <ul>
                {(genpo.questions ?? []).map((q, i) => (
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

  // Default state - show buttons
  console.log('>>> Rendering: INITIAL/BUTTONS state');

  return (
    <div className={styles.container} style={{ border: '3px solid #7c3aed' }}>
      <div style={{ background: '#7c3aed', color: 'white', padding: '4px 8px', marginBottom: '8px', fontSize: '12px' }}>
        STATE: INITIAL (click a button to start)
      </div>
      <div className={styles.buttonGroup}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Button clicked! Calling handleShowPreview...');
            handleShowPreview('questions');
          }}
          className={styles.getInsightsBtn}
        >
          <Sparkles size={18} />
          Coaching Questions
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Button clicked! Calling handleShowPreview...');
            handleShowPreview('plotSummary');
          }}
          className={styles.getInsightsBtn}
        >
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
