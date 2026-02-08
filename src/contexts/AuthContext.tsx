import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useGalleryAccess, AccessLevel } from '@/hooks/useGalleryAccess';

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
  signUpWithEmail: (email: string, password: string, nome?: string) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
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
