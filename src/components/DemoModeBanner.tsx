import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useAppSelector } from '@/store/hooks';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export function DemoModeBanner() {
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useTheme();

  if (!isDemo) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <View
      style={[
        styles.banner,
        { paddingTop: insets.top + 4 },
        isDark ? styles.bannerDark : styles.bannerLight,
      ]}
    >
      <Text style={[styles.text, isDark && styles.textDark]}>🎭 Demo Mode</Text>
      <Button
        variant="outline"
        size="sm"
        onPress={() => router.replace('/')}
      >
        Exit Demo
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bannerLight: {
    backgroundColor: '#FEF3C7',
  },
  bannerDark: {
    backgroundColor: '#422006',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textDark: {
    color: '#FDE68A',
  },
});
