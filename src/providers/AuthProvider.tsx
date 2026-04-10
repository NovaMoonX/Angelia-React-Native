import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/services/firebase/config';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (email: string, password: string) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  loading: true,
  signIn: () => Promise.reject(new Error('AuthProvider not initialized')),
  signUp: () => Promise.reject(new Error('AuthProvider not initialized')),
  signOut: () => Promise.reject(new Error('AuthProvider not initialized')),
  sendVerificationEmail: () => Promise.reject(new Error('AuthProvider not initialized')),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const handleSendVerificationEmail = useCallback(async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        loading,
        signIn,
        signUp,
        signOut: handleSignOut,
        sendVerificationEmail: handleSendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
