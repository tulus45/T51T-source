import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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

  async function hydrateSession(session) {
    if (!session?.user) {
      setAuthState(getLoggedOutState());
      return;
    }

    try {
      const profile = await authService.getProfileByUserId(session.user.id);

      if (!profile.is_active) {
        await authService.logoutSession();
        throw new Error('Akun Anda sedang nonaktif. Hubungi super admin.');
      }

      setAuthState({
        session,
        user: session.user,
        profile,
        loading: false,
      });
    } catch (error) {
      setAuthState(getLoggedOutState());
      throw error;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const session = await authService.getCurrentSession();

        if (!isMounted) {
          return;
        }

        await hydrateSession(session);
      } catch {
        if (isMounted) {
          setAuthState(getLoggedOutState());
        }
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (!isMounted) {
          return;
        }

        hydrateSession(session).catch(() => {
          if (isMounted) {
            setAuthState(getLoggedOutState());
          }
        });
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    setAuthState((current) => ({
      ...current,
      loading: true,
    }));

    try {
      const data = await authService.loginWithPassword({ email, password });
      const profile = await authService.getProfileByUserId(data.user.id);

      if (!profile.is_active) {
        await authService.logoutSession();
        throw new Error('Akun Anda sedang nonaktif. Hubungi super admin.');
      }

      setAuthState({
        session: data.session,
        user: data.user,
        profile,
        loading: false,
      });

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
    if (!authState.user?.id) {
      return null;
    }

    const profile = await authService.getProfileByUserId(authState.user.id);

    setAuthState((current) => ({
      ...current,
      profile,
    }));

    return profile;
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isAuthenticated: Boolean(authState.session),
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
