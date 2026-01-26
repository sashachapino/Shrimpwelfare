import type { EnneagramType, EnneagramWing } from '../types';
import styles from './EnneagramIndicator.module.css';

interface EnneagramIndicatorProps {
  type: EnneagramType;
  wing: EnneagramWing;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (type: EnneagramType, wing: EnneagramWing) => void;
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

const VALID_WINGS: Record<EnneagramType, EnneagramWing[]> = {
  1: [9, 2, null],
  2: [1, 3, null],
  3: [2, 4, null],
  4: [3, 5, null],
  5: [4, 6, null],
  6: [5, 7, null],
  7: [6, 8, null],
  8: [7, 9, null],
  9: [8, 1, null],
  '?': [null],
};

export function EnneagramIndicator({
  type,
  wing,
  size = 'md',
  onChange,
}: EnneagramIndicatorProps) {
  const isInteractive = !!onChange;
  const displayType = type === '?' ? '?' : type;
  const displayWing = wing !== null ? `w${wing}` : '';
  const fullDisplay = wing !== null ? `${displayType}${displayWing}` : `${displayType}`;

  const handleTypeChange = (newType: EnneagramType) => {
    if (!onChange) return;
    // Reset wing if changing type
    const validWings = VALID_WINGS[newType];
    const newWing = validWings.includes(wing) ? wing : null;
    onChange(newType, newWing);
  };

  const handleWingChange = (newWing: EnneagramWing) => {
    if (!onChange) return;
    onChange(type, newWing);
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
          <label>Type</label>
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
            <label>Wing</label>
            <div className={styles.wingOptions}>
              {VALID_WINGS[type].map((w) => (
                <button
                  key={w ?? 'none'}
                  type="button"
                  className={`${styles.wingBtn} ${wing === w ? styles.selected : ''}`}
                  onClick={() => handleWingChange(w)}
                >
                  {w === null ? 'None' : `w${w}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.preview}>
        <span className={styles.previewType}>{fullDisplay}</span>
        <span className={styles.previewName}>{TYPE_NAMES[type]}</span>
      </div>
    </div>
  );
}
