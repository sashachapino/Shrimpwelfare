import { useReducer, useState } from 'react';
import { Sparkles, Key, Loader2, AlertCircle, Shield, Eye, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  getCoachingInsights,
  getAnonymizationPreview,
  getPlotSummary,
  getPlotSummaryPreview,
  type CoachingInsight,
  type CaseSummary,
  type AnonymizedClientData
} from '../utils/claude';
import type { Client } from '../types';
import styles from './CoachingInsights.module.css';

// Simple state machine with useReducer
type FeatureType = 'questions' | 'plotSummary';

type State =
  | { status: 'idle' }
  | { status: 'needsApiKey'; feature: FeatureType }
  | { status: 'preview'; feature: FeatureType; anonymizedData: AnonymizedClientData; promptPreview: string }
  | { status: 'loading'; feature: FeatureType; anonymizedData: AnonymizedClientData }
  | { status: 'error'; message: string; feature: FeatureType }
  | { status: 'success'; insights: CoachingInsight | null; caseSummary: CaseSummary | null };

type Action =
  | { type: 'START_FEATURE'; feature: FeatureType; hasApiKey: boolean; anonymizedData: AnonymizedClientData; promptPreview: string }
  | { type: 'API_KEY_SAVED'; anonymizedData: AnonymizedClientData; promptPreview: string }
  | { type: 'CONFIRM_SEND' }
  | { type: 'CANCEL' }
  | { type: 'SUCCESS'; insights?: CoachingInsight; caseSummary?: CaseSummary }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_FEATURE':
      if (!action.hasApiKey) {
        return { status: 'needsApiKey', feature: action.feature };
      }
      return {
        status: 'preview',
        feature: action.feature,
        anonymizedData: action.anonymizedData,
        promptPreview: action.promptPreview
      };

    case 'API_KEY_SAVED':
      if (state.status !== 'needsApiKey') return state;
      return {
        status: 'preview',
        feature: state.feature,
        anonymizedData: action.anonymizedData,
        promptPreview: action.promptPreview
      };

    case 'CONFIRM_SEND':
      if (state.status !== 'preview') return state;
      return {
        status: 'loading',
        feature: state.feature,
        anonymizedData: state.anonymizedData
      };

    case 'CANCEL':
      return { status: 'idle' };

    case 'SUCCESS':
      // Merge with existing results if any
      const prevInsights = state.status === 'success' ? state.insights : null;
      const prevCaseSummary = state.status === 'success' ? state.caseSummary : null;
      return {
        status: 'success',
        insights: action.insights ?? prevInsights,
        caseSummary: action.caseSummary ?? prevCaseSummary
      };

    case 'ERROR':
      if (state.status !== 'loading') return state;
      return { status: 'error', message: action.message, feature: state.feature };

    case 'RESET':
      return { status: 'idle' };

    default:
      return state;
  }
}

interface CoachingInsightsProps {
  client: Client;
}

export function CoachingInsights({ client }: CoachingInsightsProps) {
  const { anthropicApiKey, setAnthropicApiKey } = useApp();
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // Start a feature (questions or plot summary)
  const handleStartFeature = (feature: FeatureType) => {
    const preview = feature === 'plotSummary'
      ? getPlotSummaryPreview(client)
      : getAnonymizationPreview(client);

    dispatch({
      type: 'START_FEATURE',
      feature,
      hasApiKey: !!anthropicApiKey,
      anonymizedData: preview.anonymizedData,
      promptPreview: preview.promptPreview
    });
  };

  // Save API key and proceed to preview
  const handleSaveApiKey = async (key: string) => {
    if (!key.trim()) return;
    await setAnthropicApiKey(key.trim());

    if (state.status === 'needsApiKey') {
      const preview = state.feature === 'plotSummary'
        ? getPlotSummaryPreview(client)
        : getAnonymizationPreview(client);
      dispatch({
        type: 'API_KEY_SAVED',
        anonymizedData: preview.anonymizedData,
        promptPreview: preview.promptPreview
      });
    }
  };

  // Confirm and send to API
  const handleConfirmSend = async () => {
    if (state.status !== 'preview' || !anthropicApiKey) return;

    dispatch({ type: 'CONFIRM_SEND' });

    try {
      if (state.feature === 'plotSummary') {
        const result = await getPlotSummary(anthropicApiKey, state.anonymizedData);
        dispatch({ type: 'SUCCESS', caseSummary: result });
      } else {
        const result = await getCoachingInsights(anthropicApiKey, state.anonymizedData);
        dispatch({ type: 'SUCCESS', insights: result });
      }
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  // Render based on current state
  if (state.status === 'needsApiKey') {
    return <ApiKeyInput onSave={handleSaveApiKey} onCancel={() => dispatch({ type: 'CANCEL' })} />;
  }

  if (state.status === 'preview') {
    return (
      <PreviewScreen
        anonymizedData={state.anonymizedData}
        promptPreview={state.promptPreview}
        onConfirm={handleConfirmSend}
        onCancel={() => dispatch({ type: 'CANCEL' })}
      />
    );
  }

  if (state.status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>{state.feature === 'plotSummary' ? 'Writing plot summary...' : 'Generating coaching questions...'}</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <AlertCircle size={20} />
          <p>{state.message}</p>
          <button type="button" onClick={() => handleStartFeature(state.feature)} className="btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'success') {
    return (
      <ResultsScreen
        insights={state.insights}
        caseSummary={state.caseSummary}
        onRefresh={handleStartFeature}
      />
    );
  }

  // Idle state - show buttons
  return (
    <div className={styles.container}>
      <div className={styles.buttonGroup}>
        <button type="button" onClick={() => handleStartFeature('questions')} className={styles.getInsightsBtn}>
          <Sparkles size={18} />
          Coaching Questions
        </button>
        <button type="button" onClick={() => handleStartFeature('plotSummary')} className={styles.getInsightsBtn}>
          <BookOpen size={18} />
          Case Impressions
        </button>
      </div>
      <p className={styles.description}>
        AI-powered features. Data is anonymized before sending.
      </p>
    </div>
  );
}

// Sub-components for cleaner organization

function ApiKeyInput({ onSave, onCancel }: { onSave: (key: string) => void; onCancel: () => void }) {
  const [key, setKey] = useState('');

  return (
    <div className={styles.container}>
      <div className={styles.apiKeyPrompt}>
        <Key className={styles.keyIcon} />
        <h3>Connect Claude</h3>
        <p>Enter your Anthropic API key to enable AI-powered coaching questions</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          className={styles.apiKeyInput}
        />
        <div className={styles.apiKeyActions}>
          <button type="button" onClick={() => onSave(key)} className="btn-accent" disabled={!key.trim()}>
            Save Key
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
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

function PreviewScreen({
  anonymizedData,
  promptPreview,
  onConfirm,
  onCancel
}: {
  anonymizedData: AnonymizedClientData;
  promptPreview: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const replacements: string[] = anonymizedData.allReplacements ?? [];

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
          <button type="button" onClick={() => setShowFull(!showFull)} className={styles.toggleBtn}>
            <Eye size={16} />
            {showFull ? 'Hide' : 'Show'} full prompt
            {showFull ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFull && (
          <div className={styles.fullPreview}>
            <pre>{promptPreview}</pre>
          </div>
        )}

        <div className={styles.previewActions}>
          <button type="button" onClick={onConfirm} className="btn-accent">
            Confirm & Send
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({
  insights,
  caseSummary,
  onRefresh
}: {
  insights: CoachingInsight | null;
  caseSummary: CaseSummary | null;
  onRefresh: (feature: FeatureType) => void;
}) {
  const defaultPerspective = { vitalMatter: '', questions: [] };

  return (
    <div className={styles.container}>
      {caseSummary && (
        <>
          <div className={styles.header}>
            <h2>
              <BookOpen size={20} />
              Case Impressions
            </h2>
            <button type="button" onClick={() => onRefresh('plotSummary')} className={styles.refreshBtn}>
              Refresh
            </button>
          </div>

          <ImpressionSection
            name="Diana Chapman"
            subtitle="Conscious Leadership"
            impression={caseSummary.dianaChapman?.impression ?? ''}
          />
          <ImpressionSection
            name="Bruce Tift"
            subtitle="Developmental/Relational"
            impression={caseSummary.bruceTift?.impression ?? ''}
          />
          <ImpressionSection
            name="Jonathan Shedler"
            subtitle="Psychodynamic"
            impression={caseSummary.jonathanShedler?.impression ?? ''}
          />
          <ImpressionSection
            name="Genpo Roshi"
            subtitle="Big Mind Process"
            impression={caseSummary.genpoRoshi?.impression ?? ''}
          />
        </>
      )}

      {insights && (
        <>
          <div className={styles.header}>
            <h2>
              <Sparkles size={20} />
              Coaching Questions
            </h2>
            <button type="button" onClick={() => onRefresh('questions')} className={styles.refreshBtn}>
              Refresh
            </button>
          </div>

          <PerspectiveSection name="Diana Chapman" subtitle="Conscious Leadership" data={insights.dianaChapman ?? defaultPerspective} />
          <PerspectiveSection name="Bruce Tift" subtitle="Developmental/Relational" data={insights.bruceTift ?? defaultPerspective} />
          <PerspectiveSection name="Jonathan Shedler" subtitle="Psychodynamic" data={insights.jonathanShedler ?? defaultPerspective} />
          <PerspectiveSection name="Genpo Roshi" subtitle="Big Mind Process" data={insights.genpoRoshi ?? defaultPerspective} />
        </>
      )}

      <div className={styles.additionalActions}>
        {!caseSummary && (
          <button type="button" onClick={() => onRefresh('plotSummary')} className={styles.secondaryActionBtn}>
            <BookOpen size={16} />
            Get Case Impressions
          </button>
        )}
        {!insights && (
          <button type="button" onClick={() => onRefresh('questions')} className={styles.secondaryActionBtn}>
            <Sparkles size={16} />
            Get Coaching Questions
          </button>
        )}
      </div>
    </div>
  );
}

function PerspectiveSection({
  name,
  subtitle,
  data
}: {
  name: string;
  subtitle: string;
  data: { vitalMatter: string; questions: string[] };
}) {
  return (
    <div className={styles.insightSection}>
      <h3 className={styles.perspectiveTitle}>
        {name}
        <span className={styles.perspectiveSubtitle}>{subtitle}</span>
      </h3>
      {data.vitalMatter && (
        <p className={styles.vitalMatter}>{data.vitalMatter}</p>
      )}
      <ul>
        {data.questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </div>
  );
}

function ImpressionSection({
  name,
  subtitle,
  impression
}: {
  name: string;
  subtitle: string;
  impression: string;
}) {
  return (
    <div className={styles.insightSection}>
      <h3 className={styles.perspectiveTitle}>
        {name}
        <span className={styles.perspectiveSubtitle}>{subtitle}</span>
      </h3>
      {impression && (
        <p className={styles.impression}>{impression}</p>
      )}
    </div>
  );
}
