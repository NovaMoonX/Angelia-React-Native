import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export function SkeletonPostCard() {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Skeleton shape="circle" width={32} height={32} />
        <View style={styles.headerText}>
          <Skeleton width={120} height={14} />
          <Skeleton width={60} height={10} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      <Skeleton height={14} style={{ marginBottom: 8 }} />
      <Skeleton width={240} height={14} style={{ marginBottom: 12 }} />
      <Skeleton height={160} borderRadius={8} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
});
