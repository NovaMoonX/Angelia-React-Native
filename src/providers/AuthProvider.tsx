import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch } from '@/store/hooks';
import { fetchUserProfile, updateAccountProgress } from '@/store/actions/userActions';
import { ensureDailyChannelExists } from '@/store/actions/channelActions';
import { resetAllState } from '@/store/actions/globalActions';
import type { User } from '@/models/types';

const DEMO_MODE_KEY = '@angelia/demo_mode';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (googleWebClientId) {
  GoogleSignin.configure({ webClientId: googleWebClientId });
}

interface AuthContextType {
  firebaseUser: FirebaseAuthTypes.User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<FirebaseAuthTypes.User>;
  signUp: (email: string, password: string) => Promise<FirebaseAuthTypes.User>;
  signInWithGoogle: () => Promise<FirebaseAuthTypes.User>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isDemoMode: boolean;
  enterDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  loading: true,
  signIn: () => Promise.reject(new Error('AuthProvider not initialized')),
  signUp: () => Promise.reject(new Error('AuthProvider not initialized')),
  signInWithGoogle: () => Promise.reject(new Error('AuthProvider not initialized')),
  signOut: () => Promise.reject(new Error('AuthProvider not initialized')),
  sendVerificationEmail: () => Promise.reject(new Error('AuthProvider not initialized')),
  isDemoMode: false,
  enterDemo: () => Promise.reject(new Error('AuthProvider not initialized')),
  exitDemo: () => Promise.reject(new Error('AuthProvider not initialized')),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const dispatch = useAppDispatch();

  // Restore persisted demo mode flag on mount
  useEffect(() => {
    AsyncStorage.getItem(DEMO_MODE_KEY).then((value) => {
      if (value === 'true') setIsDemoMode(true);
    });
  }, []);

  // Native Firebase auth state is automatically persisted
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        try {
          const profile = await dispatch(fetchUserProfile(user.uid)).unwrap();

          if (user.emailVerified && profile && !profile.accountProgress.emailVerified) {
            await dispatch(
              updateAccountProgress({ uid: user.uid, field: 'emailVerified', value: true })
            ).unwrap();
          }

          if (
            profile?.accountProgress.signUpComplete &&
            (user.emailVerified || profile.accountProgress.emailVerified)
          ) {
            dispatch(ensureDailyChannelExists(user.uid));
          }
        } catch {
          // Profile not yet created (new sign-up in progress)
        }
      } else {
        dispatch(resetAllState());
      }
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [dispatch]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(getAuth(), email, password);
    return result.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(getAuth(), email, password);
    return result.user;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!googleWebClientId) {
      throw new Error('Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    if (!idToken) throw new Error('Google sign-in failed — no ID token');
    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(getAuth(), googleCredential);
    return result.user;
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(getAuth());
    await AsyncStorage.removeItem(DEMO_MODE_KEY);
    setIsDemoMode(false);
  }, []);

  const handleSendVerificationEmail = useCallback(async () => {
    await getAuth().currentUser?.sendEmailVerification();
  }, []);

  const enterDemo = useCallback(async () => {
    setIsDemoMode(true);
    await AsyncStorage.setItem(DEMO_MODE_KEY, 'true');
  }, []);

  const exitDemo = useCallback(async () => {
    setIsDemoMode(false);
    await AsyncStorage.removeItem(DEMO_MODE_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut: handleSignOut,
        sendVerificationEmail: handleSendVerificationEmail,
        isDemoMode,
        enterDemo,
        exitDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
