import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useGalleryAccess, AccessLevel } from '@/hooks/useGalleryAccess';
import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint } from '@/lib/deviceFingerprint';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accessLevel: AccessLevel;
  hasGalleryAccess: boolean;
  hasGestaoIntegration: boolean;
  isAdmin: boolean;
  planName: string | null;
  accessLoading: boolean;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string, nome?: string, referralCode?: string, deviceFingerprint?: string) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { 
    user, 
    session, 
    loading, 
    signInWithGoogle, 
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    updateEmail,
    signOut 
  } = useAuth();
  
  const { 
    hasAccess, 
    accessLevel, 
    planName, 
    isLoading: accessLoading,
    hasGestaoIntegration,
    isAdmin,
  } = useGalleryAccess(user, session);

  // Register referral code after login if present in user metadata
  const referralProcessedRef = useRef(false);
  useEffect(() => {
    if (!user || referralProcessedRef.current) return;
    
    // Check both user metadata (email signup) and localStorage (Google OAuth)
    const metaRefCode = user.user_metadata?.referral_code;
    const pendingRefCode = localStorage.getItem('pending_referral_code');
    const refCode = metaRefCode || pendingRefCode;
    
    if (!refCode) return;
    
    referralProcessedRef.current = true;
    console.log('🎁 Processing referral code:', refCode, metaRefCode ? '(from metadata)' : '(from localStorage)');
    
    supabase.rpc('register_referral', { _referral_code: refCode } as any)
      .then(({ data, error }) => {
        if (error) {
          console.warn('Referral registration failed (may already exist):', error.message);
        } else if (data) {
          console.log('✅ Referral registered successfully');
        }
        // Clean up both sources
        if (metaRefCode) {
          supabase.auth.updateUser({ data: { referral_code: null } });
        }
        if (pendingRefCode) {
          localStorage.removeItem('pending_referral_code');
        }
      });
  }, [user]);

  // Debug logging
  useEffect(() => {
    console.log('📊 AuthContext state:', {
      user: user?.email,
      loading,
      accessLoading,
      accessLevel,
      hasAccess,
    });
  }, [user, loading, accessLoading, accessLevel, hasAccess]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    accessLevel,
    hasGalleryAccess: hasAccess,
    hasGestaoIntegration,
    isAdmin,
    planName,
    accessLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    updatePassword,
    updateEmail,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
