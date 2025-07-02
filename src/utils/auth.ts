
interface AdminCredentials {
  username: string;
  password: string;
}

// In a real app, this would be stored in a database
// This is a simple implementation for demonstration purposes
const ADMIN_KEY = 'scifilter-admin-credentials';

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

export const initializeDefaultAdmin = () => {
  const existing = getStoredCredentials();
  if (!existing) {
    // Set default credentials if none exist
    const defaultCredentials: AdminCredentials = {
      username: 'admin',
      password: 'scifilter2024'
    };
    localStorage.setItem(ADMIN_KEY, JSON.stringify(defaultCredentials));
    return defaultCredentials;
  }
  return existing;
};

export const validateCredentials = (username: string, password: string): boolean => {
  const stored = getStoredCredentials();
  if (!stored) return false;
  
  return stored.username === username && stored.password === password;
};

export const updatePassword = (currentPassword: string, newPassword: string): boolean => {
  const stored = getStoredCredentials();
  if (!stored) return false;
  
  if (stored.password !== currentPassword) return false;
  
  stored.password = newPassword;
  localStorage.setItem(ADMIN_KEY, JSON.stringify(stored));
  return true;
};

export const isAuthenticated = (): boolean => {
  return sessionStorage.getItem('admin-authenticated') === 'true';
};

export const setAuthenticated = (state: boolean): void => {
  if (state) {
    sessionStorage.setItem('admin-authenticated', 'true');
  } else {
    sessionStorage.removeItem('admin-authenticated');
  }
};

