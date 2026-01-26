import styles from './AllianceIndicator.module.css';

interface AllianceIndicatorProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onChange?: (value: number) => void;
}

export function AllianceIndicator({
  value,
  size = 'md',
  showLabel = true,
  onChange,
}: AllianceIndicatorProps) {
  const getColor = (val: number) => {
    if (val <= 3) return 'low';
    if (val <= 6) return 'medium';
    return 'high';
  };

  const getLabel = (val: number) => {
    if (val <= 3) return 'Building';
    if (val <= 6) return 'Developing';
    if (val <= 8) return 'Strong';
    return 'Excellent';
  };

  const colorClass = getColor(value);
  const isInteractive = !!onChange;

  return (
    <div className={`${styles.container} ${styles[size]}`}>
      {showLabel && (
        <div className={styles.labelRow}>
          <span className={styles.label}>Alliance</span>
          <span className={`${styles.status} ${styles[colorClass]}`}>{getLabel(value)}</span>
        </div>
      )}
      <div className={`${styles.track} ${isInteractive ? styles.interactive : ''}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.dot} ${n <= value ? styles.filled : ''} ${styles[getColor(n)]}`}
            onClick={() => onChange?.(n)}
            disabled={!isInteractive}
            title={`${n}/10`}
          />
        ))}
      </div>
      <span className={`${styles.value} ${styles[colorClass]}`}>{value}/10</span>
    </div>
  );
}
