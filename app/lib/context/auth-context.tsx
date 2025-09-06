'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type SafeUser = {
  id: string;
  email: string | null;
  name?: string | null;
} | null;
type SafeSession = { user_id: string; access_token: string } | null;

/**
 * Authentication context for the application.
 * Provides session, user, signOut, loading, and error state to consumers.
 */
const AuthContext = createContext<{
  session: SafeSession;
  user: SafeUser;
  signOut: () => void;
  loading: boolean;
  error: string | null;
}>({
  session: null,
  user: null,
  signOut: () => {},
  loading: true,
  error: null,
});

/**
 * AuthProvider wraps the application and provides authentication state via context.
 * Handles user/session state, error handling, and subscription to auth state changes.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Memoize Supabase client to avoid recreating on every render
  const supabase = useMemo(() => createClient(), []);
  // State for session, user, loading, and error
  const [session, setSession] = useState<SafeSession>(null);
  const [user, setUser] = useState<SafeUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    /**
     * Fetch the current user from Supabase and update state.
     * Handles error state and ensures only safe fields are set.
     */
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setError('Failed to fetch user.');
      }
      if (mounted) {
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || null,
          });
        } else {
          setUser(null);
        }
        setSession(null);
        setLoading(false);
      }
    };

    getUser();

    /**
     * Subscribe to authentication state changes (login, logout, token refresh).
     * Updates user and session state accordingly.
     */
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession({
            user_id: session.user?.id || '',
            access_token: session.access_token,
          });
          setUser(
            session.user
              ? {
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.name || null,
                }
              : null
          );
        } else {
          setSession(null);
          setUser(null);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  /**
   * Sign out the current user, clear user/session state, and cookies if used.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    // If using cookies, clear them here
  };

  return (
    <AuthContext.Provider value={{ session, user, signOut, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access authentication context.
 * @returns Authentication context value (session, user, signOut, loading, error)
 */
export const useAuth = () => useContext(AuthContext);
