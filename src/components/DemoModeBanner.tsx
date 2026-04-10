import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useAppSelector } from '@/store/hooks';
import { useRouter } from 'expo-router';

export function DemoModeBanner() {
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const router = useRouter();

  if (!isDemo) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>🎭 Demo Mode</Text>
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
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350F',
  },
});
