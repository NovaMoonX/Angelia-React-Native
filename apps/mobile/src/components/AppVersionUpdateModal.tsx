import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ANDROID_PLAY_STORE_URL,
  BETA_UPDATE_MODAL_SEEN_KEY,
  BETA_UPDATE_VERSION,
  APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY,
  IOS_TESTFLIGHT_DEEP_LINK,
  IOS_TESTFLIGHT_WEB_URL,
  ONBOARDING_FEED_GUIDE_STATE_KEY,
} from '@/models/constants';
import { subscribeToLatestAppVersion, type LatestAppVersionConfig } from '@/services/firebase/firestore';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';

type MobilePlatform = 'ios' | 'android';

const CURRENT_PLATFORM: MobilePlatform = Platform.OS === 'ios' ? 'ios' : 'android';

function parseVersionToken(token: string): number {
  const digits = token.replace(/[^0-9]/g, '');
  if (!digits) {
    return 0;
  }
  const parsed = Number(digits);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function compareVersions(current: string, target: string): number {
  const currentParts = current.split('.');
  const targetParts = target.split('.');
  const total = Math.max(currentParts.length, targetParts.length);

  for (let i = 0; i < total; i += 1) {
    const left = parseVersionToken(currentParts[i] ?? '0');
    const right = parseVersionToken(targetParts[i] ?? '0');
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
  }
  return 0;
}

function getTargetVersion(config: LatestAppVersionConfig, platform: MobilePlatform): string | null {
  if (platform === 'ios') {
    return config.iosVersion;
  }
  return config.androidVersion;
}

export function AppVersionUpdateModal() {
  const { theme } = useTheme();
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);

  const [latestConfig, setLatestConfig] = useState<LatestAppVersionConfig | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [betaUpdateVisible, setBetaUpdateVisible] = useState(false);

  const deviceVersion = String(Constants.expoConfig?.version ?? '0.0.0');
  const targetVersion = useMemo(() => {
    if (!latestConfig) {
      return null;
    }
    return getTargetVersion(latestConfig, CURRENT_PLATFORM);
  }, [latestConfig]);

  useEffect(() => {
    if (!currentUser || isDemo) {
      setLatestConfig(null);
      setDismissedVersion(null);
      setOnboardingDismissed(false);
      setBetaUpdateVisible(false);
      return () => {};
    }

    let cancelled = false;
    const dismissedKey = APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY(CURRENT_PLATFORM);

    AsyncStorage.multiGet([
      dismissedKey,
      ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id),
      BETA_UPDATE_MODAL_SEEN_KEY(BETA_UPDATE_VERSION),
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }
        const dismissedValue = results[0][1];
        const onboardingValue = results[1][1];
        const betaSeenValue = results[2][1];
        const isOnboardingDismissed = onboardingValue === 'dismissed';
        setDismissedVersion(dismissedValue ?? null);
        setOnboardingDismissed(isOnboardingDismissed);
        setBetaUpdateVisible(isOnboardingDismissed && betaSeenValue !== 'seen');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setDismissedVersion(null);
        setOnboardingDismissed(false);
        setBetaUpdateVisible(false);
      });

    const unsubscribe = subscribeToLatestAppVersion((config) => {
      if (cancelled) {
        return;
      }
      setLatestConfig(config);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUser, isDemo]);

  const shouldShow = useMemo(() => {
    if (!currentUser || isDemo || !targetVersion || !onboardingDismissed || betaUpdateVisible) {
      return false;
    }
    if (dismissedVersion === targetVersion) {
      return false;
    }
    return compareVersions(deviceVersion, targetVersion) < 0;
  }, [currentUser, isDemo, targetVersion, dismissedVersion, deviceVersion, onboardingDismissed, betaUpdateVisible]);

  const rememberDismiss = async () => {
    if (!targetVersion) {
      return;
    }
    const key = APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY(CURRENT_PLATFORM);
    setDismissedVersion(targetVersion);
    try {
      await AsyncStorage.setItem(key, targetVersion);
    } catch {
      // Best effort only.
    }
  };

  const handleLater = async () => {
    await rememberDismiss();
  };

  const handleOpenUpdateDestination = async () => {
    await rememberDismiss();

    if (CURRENT_PLATFORM === 'ios') {
      Linking.openURL(IOS_TESTFLIGHT_DEEP_LINK).catch(() => {
        Linking.openURL(IOS_TESTFLIGHT_WEB_URL).catch(() => {
          return;
        });
      });
      return;
    }

    const url = latestConfig?.androidStoreUrl ?? ANDROID_PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {
      return;
    });
  };

  const title = CURRENT_PLATFORM === 'ios' ? 'Update available ✨' : 'New update ready ✨';
  const bodyText =
    CURRENT_PLATFORM === 'ios'
      ? 'A fresh Angelia build is out. Open TestFlight to grab the newest version and keep things smooth.'
      : 'A fresh Angelia build is out. Open the Play Store listing to update and keep things running smoothly.';

  return (
    <Modal
      isOpen={shouldShow}
      onClose={handleLater}
      title={title}
      footer={
        <View style={styles.footerButtons}>
          <Button variant='outline' onPress={handleLater} style={styles.footerButton}>
            Later
          </Button>
          <Button onPress={handleOpenUpdateDestination} style={styles.footerButton}>
            {CURRENT_PLATFORM === 'ios' ? 'Open TestFlight' : 'Open Play Store'}
          </Button>
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={[styles.message, { color: theme.foreground }]}>{bodyText}</Text>
        <Text style={[styles.versionRow, { color: theme.mutedForeground }]}>Current version: {deviceVersion}</Text>
        <Text style={[styles.versionRow, { color: theme.mutedForeground }]}>Required version: {targetVersion ?? 'unknown'}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  versionRow: {
    fontSize: 13,
    lineHeight: 18,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  footerButton: {
    flex: 1,
  },
});
