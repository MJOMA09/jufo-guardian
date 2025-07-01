
interface AdminCredentials {
  username: string;
  password: string;
  isDefaultPassword?: boolean;
  lastPasswordChange?: number;
  failedAttempts?: number;
  lockedUntil?: number;
}

// Environment-based configuration
const getEnvConfig = () => {
  return {
    defaultUsername: import.meta.env.VITE_ADMIN_USERNAME || 'admin',
    requirePasswordChange: import.meta.env.VITE_REQUIRE_PASSWORD_CHANGE === 'true',
    sessionTimeout: parseInt(import.meta.env.VITE_SESSION_TIMEOUT || '3600000'), // 1 hour default
    maxFailedAttempts: parseInt(import.meta.env.VITE_MAX_FAILED_ATTEMPTS || '5'),
    lockoutDuration: parseInt(import.meta.env.VITE_LOCKOUT_DURATION || '900000'), // 15 minutes default
  };
};

const ADMIN_KEY = 'scifilter-admin-credentials';
const SESSION_KEY = 'scifilter-session';

// Simple password hashing (for frontend-only solution)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'scifilter-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { isValid: errors.length === 0, errors };
};

export const getStoredCredentials = (): AdminCredentials | null => {
  const stored = localStorage.getItem(ADMIN_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as AdminCredentials;
  } catch (e) {
    console.error('Failed to parse stored credentials');
    return null;
  }
};

export const initializeDefaultAdmin = async (): Promise<AdminCredentials> => {
  const existing = getStoredCredentials();
  if (!existing) {
    const config = getEnvConfig();
    const defaultPassword = 'SciFilter2024!';
    const hashedPassword = await hashPassword(defaultPassword);
    
    const defaultCredentials: AdminCredentials = {
      username: config.defaultUsername,
      password: hashedPassword,
      isDefaultPassword: true,
      lastPasswordChange: Date.now(),
      failedAttempts: 0,
      lockedUntil: 0
    };
    
    localStorage.setItem(ADMIN_KEY, JSON.stringify(defaultCredentials));
    return defaultCredentials;
  }
  return existing;
};

export const validateCredentials = async (username: string, password: string): Promise<{ isValid: boolean; requiresPasswordChange?: boolean; isLocked?: boolean; lockoutTime?: number }> => {
  const stored = getStoredCredentials();
  if (!stored) return { isValid: false };
  
  const config = getEnvConfig();
  const now = Date.now();
  
  // Check if account is locked
  if (stored.lockedUntil && stored.lockedUntil > now) {
    return { 
      isValid: false, 
      isLocked: true, 
      lockoutTime: stored.lockedUntil 
    };
  }
  
  const hashedPassword = await hashPassword(password);
  const isValid = stored.username === username && stored.password === hashedPassword;
  
  if (!isValid) {
    // Increment failed attempts
    stored.failedAttempts = (stored.failedAttempts || 0) + 1;
    
    if (stored.failedAttempts >= config.maxFailedAttempts) {
      stored.lockedUntil = now + config.lockoutDuration;
    }
    
    localStorage.setItem(ADMIN_KEY, JSON.stringify(stored));
    return { isValid: false };
  }
  
  // Reset failed attempts on successful login
  stored.failedAttempts = 0;
  stored.lockedUntil = 0;
  localStorage.setItem(ADMIN_KEY, JSON.stringify(stored));
  
  return { 
    isValid: true, 
    requiresPasswordChange: stored.isDefaultPassword || config.requirePasswordChange 
  };
};

export const updatePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  const stored = getStoredCredentials();
  if (!stored) return { success: false, error: 'No credentials found' };
  
  const currentHashed = await hashPassword(currentPassword);
  if (stored.password !== currentHashed) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  const validation = validatePasswordStrength(newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }
  
  const newHashed = await hashPassword(newPassword);
  stored.password = newHashed;
  stored.isDefaultPassword = false;
  stored.lastPasswordChange = Date.now();
  stored.failedAttempts = 0;
  stored.lockedUntil = 0;
  
  localStorage.setItem(ADMIN_KEY, JSON.stringify(stored));
  return { success: true };
};

export const isAuthenticated = (): boolean => {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (!session) return false;
  
  try {
    const sessionData = JSON.parse(session);
    const config = getEnvConfig();
    
    // Check if session has expired
    if (Date.now() - sessionData.timestamp > config.sessionTimeout) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    
    return sessionData.authenticated === true;
  } catch {
    return false;
  }
};

export const setAuthenticated = (state: boolean): void => {
  if (state) {
    const sessionData = {
      authenticated: true,
      timestamp: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
};

export const getPasswordRequirements = () => {
  return [
    'At least 12 characters long',
    'Contains uppercase letters (A-Z)',
    'Contains lowercase letters (a-z)',
    'Contains numbers (0-9)',
    'Contains special characters (!@#$%^&*(),.?":{}|<>)'
  ];
};

export const getRemainingLockoutTime = (): number => {
  const stored = getStoredCredentials();
  if (!stored || !stored.lockedUntil) return 0;
  
  const remaining = stored.lockedUntil - Date.now();
  return Math.max(0, remaining);
};
