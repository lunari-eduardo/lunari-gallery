import React, { createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
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
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, session, loading, signInWithGoogle, signOut } = useAuth();
  const { 
    hasAccess, 
    accessLevel, 
    planName, 
    isLoading: accessLoading,
    hasGestaoIntegration,
    isAdmin,
  } = useGalleryAccess(user);

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
