import type { EnneagramType } from '../types';
import styles from './EnneagramIndicator.module.css';

interface EnneagramIndicatorProps {
  type: EnneagramType;
  secondary: EnneagramType | null;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (type: EnneagramType, secondary: EnneagramType | null) => void;
}

const TYPE_NAMES: Record<EnneagramType, string> = {
  1: 'Reformer',
  2: 'Helper',
  3: 'Achiever',
  4: 'Individualist',
  5: 'Investigator',
  6: 'Loyalist',
  7: 'Enthusiast',
  8: 'Challenger',
  9: 'Peacemaker',
  '?': 'Unknown',
};

export function EnneagramIndicator({
  type,
  secondary,
  size = 'md',
  onChange,
}: EnneagramIndicatorProps) {
  const isInteractive = !!onChange;
  const displayType = type === '?' ? '?' : type;
  const fullDisplay = secondary !== null && secondary !== '?'
    ? `${displayType}/${secondary}`
    : `${displayType}`;

  const handleTypeChange = (newType: EnneagramType) => {
    if (!onChange) return;
    // Reset secondary if it matches the new primary
    const newSecondary = secondary === newType ? null : secondary;
    onChange(newType, newSecondary);
  };

  const handleSecondaryChange = (newSecondary: EnneagramType | null) => {
    if (!onChange) return;
    onChange(type, newSecondary);
  };

  if (!isInteractive) {
    return (
      <div className={`${styles.container} ${styles[size]}`}>
        <div className={styles.badge}>
          <span className={styles.type}>{fullDisplay}</span>
        </div>
        <span className={styles.name}>{TYPE_NAMES[type]}</span>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles[size]} ${styles.interactive}`}>
      <div className={styles.selectors}>
        <div className={styles.field}>
          <label>Primary Type</label>
          <div className={styles.typeGrid}>
            {(['?', 1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.typeBtn} ${type === t ? styles.selected : ''}`}
                onClick={() => handleTypeChange(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {type !== '?' && (
          <div className={styles.field}>
            <label>Secondary Type (optional)</label>
            <div className={styles.typeGrid}>
              <button
                type="button"
                className={`${styles.typeBtn} ${secondary === null ? styles.selected : ''}`}
                onClick={() => handleSecondaryChange(null)}
              >
                —
              </button>
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[])
                .filter(t => t !== type) // Can't be same as primary
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.typeBtn} ${secondary === t ? styles.selected : ''}`}
                    onClick={() => handleSecondaryChange(t)}
                  >
                    {t}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.preview}>
        <span className={styles.previewType}>{fullDisplay}</span>
        <span className={styles.previewName}>
          {TYPE_NAMES[type]}
          {secondary !== null && secondary !== '?' && ` / ${TYPE_NAMES[secondary]}`}
        </span>
      </div>
    </div>
  );
}
