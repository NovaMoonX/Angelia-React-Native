import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ANDROID_PLAY_STORE_URL,
  IOS_TESTFLIGHT_DEEP_LINK,
  IOS_TESTFLIGHT_WEB_URL,
} from '@/models/constants';
import type { MobileAppConfig } from '@/services/firebase/firestore';
import { useTheme } from '@/hooks/useTheme';

type MobilePlatform = 'ios' | 'android';

const CURRENT_PLATFORM: MobilePlatform = Platform.OS === 'ios' ? 'ios' : 'android';

interface AppVersionUpdateModalProps {
  visible: boolean;
  onClose: () => void;
  mobileConfig: MobileAppConfig | null;
  deviceVersion: string;
  targetVersion: string | null;
}

export function AppVersionUpdateModal({ visible, onClose, mobileConfig, deviceVersion, targetVersion }: AppVersionUpdateModalProps) {
  const { theme } = useTheme();

  const handleOpenUpdateDestination = async () => {
    onClose();

    if (CURRENT_PLATFORM === 'ios') {
      Linking.openURL(IOS_TESTFLIGHT_DEEP_LINK).catch(() => {
        Linking.openURL(IOS_TESTFLIGHT_WEB_URL).catch(() => {
          return;
        });
      });
      return;
    }

    const url = mobileConfig?.androidStoreUrl ?? ANDROID_PLAY_STORE_URL;
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
      isOpen={visible}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.footerButtons}>
          <Button variant='outline' onPress={onClose} style={styles.footerButton}>
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
