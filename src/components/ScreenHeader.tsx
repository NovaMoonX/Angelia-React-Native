import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({ title, showBack = true, onBack, rightAction }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const { theme } = useTheme();

  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: isDemo ? 10 : insets.top + 10,
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {showBack && (
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.foreground} />
        </Pressable>
      )}
      <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      {rightAction != null && (
        <View style={styles.rightAction}>{rightAction}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  rightAction: {
    marginLeft: 'auto',
  },
});
