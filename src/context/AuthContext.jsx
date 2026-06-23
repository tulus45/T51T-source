import { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

const initialState = {
  session: null,
  user: null,
  profile: null,
  loading: true,
};

function getLoggedOutState() {
  return {
    session: null,
    user: null,
    profile: null,
    loading: false,
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(initialState);

  function applyAuthPayload(payload) {
    if (!payload?.session?.token || !payload?.user || !payload?.profile) {
      setAuthState(getLoggedOutState());
      return null;
    }

    const nextState = {
      session: payload.session,
      user: payload.user,
      profile: payload.profile,
      loading: false,
    };

    setAuthState(nextState);
    return nextState;
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const data = await authService.getCurrentSession();

        if (!isMounted) {
          return;
        }

        applyAuthPayload(data);
      } catch {
        if (isMounted) {
          setAuthState(getLoggedOutState());
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(email, password) {
    setAuthState((current) => ({
      ...current,
      loading: true,
    }));

    try {
      const data = await authService.loginWithPassword({ email, password });
      applyAuthPayload(data);
      return data;
    } catch (error) {
      setAuthState(getLoggedOutState());
      throw error;
    }
  }

  async function logout() {
    await authService.logoutSession();
    setAuthState(getLoggedOutState());
  }

  async function refreshProfile() {
    const data = await authService.getCurrentSession();

    if (!data) {
      setAuthState(getLoggedOutState());
      return null;
    }

    applyAuthPayload(data);
    return data.profile;
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isAuthenticated: Boolean(authState.session?.token),
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext harus digunakan di dalam AuthProvider.');
  }

  return context;
}
