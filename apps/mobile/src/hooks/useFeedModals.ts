import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { subscribeToMobileAppConfig, type MobileAppConfig } from '@/services/firebase/firestore';
import {
  BETA_UPDATE_MODAL_SEEN_KEY,
  BETA_UPDATE_VERSION,
  ONBOARDING_FEED_GUIDE_STATE_KEY,
  APP_MESSAGE_DISMISSED_KEY,
  FEEDBACK_FORM_DISMISSED_URL_KEY,
  APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY,
} from '@/models/constants';

/**
 * Feed modal priority (highest → lowest):
 *   1. onboarding   — must complete first-run guide before anything else
 *   2. betaUpdate   — see what's new (only after onboarding)
 *   3. appVersion   — required app update prompt from Firestore
 *   4. appMessage   — broadcast message from Firestore (info/warning/success/urgent)
 *   5. feedbackForm — feedback request (only when user is on latest version)
 */
export type FeedModalId = 'onboarding' | 'betaUpdate' | 'appVersion' | 'appMessage' | 'feedbackForm';

export interface FeedModalsState {
  /** Which modal (if any) should currently be visible. */
  activeModal: FeedModalId | null;
  /** The latest mobile config from Firestore, for use in modal components. */
  mobileConfig: MobileAppConfig | null;
  /** Current device app version string (e.g. "1.2.3"). */
  deviceVersion: string;
  /** Required version for this platform from Firestore. Null when not yet loaded or unset. */
  targetVersion: string | null;
  closeOnboarding: () => Promise<void>;
  closeBetaUpdate: () => Promise<void>;
  closeAppVersion: () => Promise<void>;
  closeAppMessage: () => Promise<void>;
  closeFeedbackForm: () => Promise<void>;
}

function parseVersionToken(token: string): number {
  const digits = token.replace(/[^0-9]/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareVersions(current: string, target: string): number {
  const a = current.split('.');
  const b = target.split('.');
  const total = Math.max(a.length, b.length);
  for (let i = 0; i < total; i += 1) {
    const left = parseVersionToken(a[i] ?? '0');
    const right = parseVersionToken(b[i] ?? '0');
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

const CURRENT_PLATFORM: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

export function useFeedModals(): FeedModalsState {
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);

  const [mobileConfig, setMobileConfig] = useState<MobileAppConfig | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [betaUpdateSeen, setBetaUpdateSeen] = useState(false);
  const [dismissedAppVersion, setDismissedAppVersion] = useState<string | null>(null);
  const [appMessageDismissedId, setAppMessageDismissedId] = useState<string | null>(null);
  const [feedbackFormDismissedUrl, setFeedbackFormDismissedUrl] = useState<string | null>(null);
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false);

  // Load all AsyncStorage state at once on mount / user change.
  useEffect(() => {
    let cancelled = false;

    if (!currentUser || isDemo) {
      setOnboardingDismissed(false);
      setBetaUpdateSeen(false);
      setDismissedAppVersion(null);
      setAppMessageDismissedId(null);
      setFeedbackFormDismissedUrl(null);
      setLocalStorageLoaded(false);
      return () => {};
    }

    AsyncStorage.multiGet([
      ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id),
      BETA_UPDATE_MODAL_SEEN_KEY(BETA_UPDATE_VERSION),
      APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY(CURRENT_PLATFORM),
      APP_MESSAGE_DISMISSED_KEY,
      FEEDBACK_FORM_DISMISSED_URL_KEY,
    ])
      .then((results) => {
        if (cancelled) return;
        setOnboardingDismissed(results[0][1] === 'dismissed');
        setBetaUpdateSeen(results[1][1] === 'seen');
        setDismissedAppVersion(results[2][1] ?? null);
        setAppMessageDismissedId(results[3][1] ?? null);
        setFeedbackFormDismissedUrl(results[4][1] ?? null);
        setLocalStorageLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLocalStorageLoaded(true);
      });

    return () => { cancelled = true; };
  }, [currentUser, isDemo]);

  // Subscribe to Firestore app config.
  useEffect(() => {
    if (!currentUser || isDemo) {
      setMobileConfig(null);
      return () => {};
    }

    const unsubscribe = subscribeToMobileAppConfig((config) => {
      setMobileConfig(config);
    });

    return unsubscribe;
  }, [currentUser, isDemo]);

  const deviceVersion = String(Constants.expoConfig?.version ?? '0.0.0');

  const targetVersion = useMemo(() => {
    if (!mobileConfig) return null;
    return CURRENT_PLATFORM === 'ios' ? mobileConfig.iosVersion : mobileConfig.androidVersion;
  }, [mobileConfig]);

  const activeModal = useMemo((): FeedModalId | null => {
    if (!currentUser || isDemo || !localStorageLoaded) return null;

    // 1. Onboarding — blocks everything else.
    if (!onboardingDismissed) {
      return 'onboarding';
    }

    // 2. Beta update — see what's new.
    if (!betaUpdateSeen) {
      return 'betaUpdate';
    }

    // 3. App version — required update prompt.
    if (targetVersion && dismissedAppVersion !== targetVersion && compareVersions(deviceVersion, targetVersion) < 0) {
      return 'appVersion';
    }

    // 4. Broadcast message.
    const msg = mobileConfig?.broadcastMessage;
    if (msg?.active && msg.id && msg.id !== appMessageDismissedId && msg.title && msg.body) {
      return 'appMessage';
    }

    // 5. Feedback form.
    const form = mobileConfig?.feedbackForm;
    if (form?.active && form.url && form.url !== feedbackFormDismissedUrl) {
      return 'feedbackForm';
    }

    return null;
  }, [
    currentUser,
    isDemo,
    localStorageLoaded,
    onboardingDismissed,
    betaUpdateSeen,
    targetVersion,
    dismissedAppVersion,
    deviceVersion,
    mobileConfig,
    appMessageDismissedId,
    feedbackFormDismissedUrl,
  ]);

  const closeOnboarding = useCallback(async () => {
    setOnboardingDismissed(true);
    if (!currentUser) return;
    try {
      await AsyncStorage.setItem(ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id), 'dismissed');
    } catch {
      // Best-effort.
    }
  }, [currentUser]);

  const closeBetaUpdate = useCallback(async () => {
    setBetaUpdateSeen(true);
    try {
      await AsyncStorage.setItem(BETA_UPDATE_MODAL_SEEN_KEY(BETA_UPDATE_VERSION), 'seen');
    } catch {
      // Best-effort.
    }
  }, []);

  const closeAppVersion = useCallback(async () => {
    if (!targetVersion) return;
    setDismissedAppVersion(targetVersion);
    try {
      await AsyncStorage.setItem(APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY(CURRENT_PLATFORM), targetVersion);
    } catch {
      // Best-effort.
    }
  }, [targetVersion]);

  const closeAppMessage = useCallback(async () => {
    const id = mobileConfig?.broadcastMessage?.id ?? null;
    setAppMessageDismissedId(id);
    if (!id) return;
    try {
      await AsyncStorage.setItem(APP_MESSAGE_DISMISSED_KEY, id);
    } catch {
      // Best-effort.
    }
  }, [mobileConfig]);

  const closeFeedbackForm = useCallback(async () => {
    const url = mobileConfig?.feedbackForm?.url ?? null;
    setFeedbackFormDismissedUrl(url);
    if (!url) return;
    try {
      await AsyncStorage.setItem(FEEDBACK_FORM_DISMISSED_URL_KEY, url);
    } catch {
      // Best-effort.
    }
  }, [mobileConfig]);

  return {
    activeModal,
    mobileConfig,
    deviceVersion,
    targetVersion,
    closeOnboarding,
    closeBetaUpdate,
    closeAppVersion,
    closeAppMessage,
    closeFeedbackForm,
  };
}
