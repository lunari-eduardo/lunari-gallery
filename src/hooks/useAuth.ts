import { useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
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

  const signInWithEmail = async (email: string, password: string) => {
    console.log('🔐 Starting email sign-in');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ Email sign-in error:', error);
      return { error };
    }
    
    console.log('✅ Email sign-in successful');
    return { error: null };
  };

  const signUpWithEmail = async (email: string, password: string, nome?: string) => {
    console.log('📝 Starting email sign-up');
    
    const redirectUrl = window.location.origin;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: nome || '',
          name: nome || '',
        },
      },
    });
    
    if (error) {
      console.error('❌ Sign-up error:', error);
      return { error, needsEmailConfirmation: false };
    }
    
    // Se email não está confirmado, Supabase retorna user mas sem sessão
    const needsEmailConfirmation = !!(data.user && !data.session);
    
    console.log('✅ Sign-up successful, needs confirmation:', needsEmailConfirmation);
    return { error: null, needsEmailConfirmation };
  };

  const resetPassword = async (email: string) => {
    console.log('🔄 Starting password reset for:', email);
    
    const redirectUrl = `${window.location.origin}/auth?reset=true`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    if (error) {
      console.error('❌ Password reset error:', error);
      return { error };
    }
    
    console.log('✅ Password reset email sent');
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    console.log('🔒 Updating password');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    
    if (error) {
      console.error('❌ Password update error:', error);
      return { error };
    }
    
    console.log('✅ Password updated successfully');
    return { error: null };
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
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    signOut,
  };
}
