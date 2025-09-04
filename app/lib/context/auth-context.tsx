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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<SafeSession>(null);
  const [user, setUser] = useState<SafeUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
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

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

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

export const useAuth = () => useContext(AuthContext);
