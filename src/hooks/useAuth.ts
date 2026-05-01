import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const isPreviewHost = () =>
  typeof window !== 'undefined' &&
  /(^|\.)lovable(project)?\.com$|(^|\.)lovable\.app$/.test(window.location.hostname);

let previewDemoLoginPromise: Promise<Session | null> | null = null;

async function signInPreviewDemo() {
  if (!previewDemoLoginPromise) {
    previewDemoLoginPromise = supabase.functions.invoke('demo-login').then(async ({ data, error }) => {
      if (error) throw error;

      const session = data?.session;
      if (!session?.access_token || !session?.refresh_token) {
        throw new Error('Demo session was not returned. Please try again.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (sessionError) throw sessionError;
      return sessionData.session;
    }).catch((error) => {
      previewDemoLoginPromise = null;
      throw error;
    });
  }

  return previewDemoLoginPromise;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
        });
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session && isPreviewHost()) {
        try {
          session = await signInPreviewDemo();
        } catch (error) {
          console.error('Preview demo sign-in failed:', error);
        }
      }

      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { data, error };
  }, []);

  const signInWithDemo = useCallback(async () => {
    try {
      const session = await signInPreviewDemo();
      return { data: { session, user: session?.user ?? null }, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithDemo,
    signOut,
  };
}
