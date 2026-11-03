'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  authError: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: string, institution?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) {
        setProfile(null);
        setAuthError(error.message);
        return;
      }
      if (!data) {
        setProfile(null);
        setAuthError('Your account profile could not be found.');
        return;
      }
      setProfile({ ...(data as Profile), role: data.role?.toLowerCase() });
      setAuthError(null);
    } catch (error) {
      setProfile(null);
      setAuthError(error instanceof Error ? error.message : 'Unable to load your account profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        setSession(data.session);
        if (data.session) {
          await fetchProfile(data.session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      } catch (error) {
        setSession(null);
        setProfile(null);
        setAuthError(error instanceof Error ? error.message : 'Unable to load your session.');
        setLoading(false);
      }
    }

    let unsubscribe = () => {};
    try {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setAuthError(null);
        if (newSession) {
          setLoading(true);
          void fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    } catch {
      // Missing Supabase config: loadSession below reports the error.
    }
    void loadSession();

    return () => unsubscribe();
  }, [fetchProfile]);

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unexpected sign-in error.' };
    }
  }

  async function signUp(email: string, password: string, fullName: string, role: string, institution?: string) {
    const safeRole = role.toLowerCase() === 'student' ? 'student' : 'professor';
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ??
            (process.env.NODE_ENV === 'development' ? process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL : undefined) ??
            `${window.location.origin}/auth/callback`,
          data: { full_name: fullName, requested_role: safeRole, institution },
        },
      });
      return { error: error?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unexpected sign-up error.' };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      setProfile(null);
      setSession(null);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, authError, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
