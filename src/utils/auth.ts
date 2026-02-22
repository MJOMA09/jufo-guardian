const SESSION_KEY = 'scifilter-session';
const SESSION_TIMEOUT = 3600000; // 1 hour

export const isAuthenticated = (): boolean => {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (!session) return false;

  try {
    const sessionData = JSON.parse(session);
    if (Date.now() - sessionData.timestamp > SESSION_TIMEOUT) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    return sessionData.authenticated === true;
  } catch {
    return false;
  }
};

export const setAuthenticated = (state: boolean, sessionToken?: string): void => {
  if (state) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        authenticated: true,
        sessionToken,
        timestamp: Date.now(),
      })
    );
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
};
