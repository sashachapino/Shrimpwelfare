import { useState, type FormEvent } from 'react';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import styles from './LockScreen.module.css';

export function LockScreen() {
  const { hasData, unlock, initialize, loading, error, clearError } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();

    if (hasData) {
      await unlock(password);
    } else {
      if (password !== confirmPassword) {
        return;
      }
      if (password.length < 8) {
        return;
      }
      await initialize(password);
    }
  }

  const isValidNewPassword = !hasData && password.length >= 8 && password === confirmPassword;
  const canSubmit = hasData ? password.length > 0 : isValidNewPassword;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <Shield className={styles.icon} />
        </div>

        <h1 className={styles.title}>Coaching CRM</h1>
        <p className={styles.subtitle}>
          {hasData
            ? 'Enter your password to unlock your client data'
            : 'Create a password to secure your client data'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasData ? 'Enter your password' : 'Create a strong password'}
                autoFocus
                autoComplete={hasData ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!hasData && (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className={styles.requirements}>
                <p className={password.length >= 8 ? styles.valid : ''}>
                  At least 8 characters
                </p>
                <p className={password === confirmPassword && confirmPassword.length > 0 ? styles.valid : ''}>
                  Passwords match
                </p>
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={`btn-primary ${styles.submitBtn}`}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Please wait...' : hasData ? 'Unlock' : 'Create & Continue'}
          </button>
        </form>

        <div className={styles.securityNote}>
          <Shield size={14} />
          <span>Your data is encrypted locally and never leaves your device</span>
        </div>
      </div>
    </div>
  );
}
