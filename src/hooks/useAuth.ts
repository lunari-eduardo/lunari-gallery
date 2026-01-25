import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 useAuth: Setting up auth listener...');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔔 Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    // Salvar origem do login para recuperar após callback
    const origin = window.location.origin;
    localStorage.setItem('auth_origin', origin);
    
    // Normalizar URL removendo barra final para garantir match exato
    const redirectUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    console.log('🚀 Starting Google sign-in');
    console.log('📍 Origin saved:', origin);
    console.log('🔗 Redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    
    if (error) {
      console.error('❌ Sign-in error:', error);
      localStorage.removeItem('auth_origin');
    }
    
    return { error };
  };

  const signOut = async () => {
    console.log('🚪 Starting sign out...');
    
    // Always clear local state first, regardless of API response
    // This handles cases where the session is already invalid on the server
    setUser(null);
    setSession(null);
    
    // Clear any stored auth data
    localStorage.removeItem('auth_origin');
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('⚠️ Sign out API error (session may already be invalid):', error.message);
        // Don't return error if it's just "session not found" - we've already cleared local state
        if (error.message?.includes('session_not_found') || error.status === 403) {
          console.log('✅ Local session cleared despite server error');
          return { error: null };
        }
      }
      console.log('✅ Sign out successful');
      return { error };
    } catch (err) {
      console.error('❌ Sign out exception:', err);
      // Still return success since we've cleared local state
      return { error: null };
    }
  };

  return {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };
}
