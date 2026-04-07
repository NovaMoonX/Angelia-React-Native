import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const COMPARISONS = [
  { feature: 'Channel-Based Updates', angelia: true, groupChat: false },
  { feature: 'Notification Tiers', angelia: true, groupChat: false },
  { feature: 'Subscriber Choice', angelia: true, groupChat: false },
  { feature: 'Auto-Expiring Content', angelia: true, groupChat: false },
  { feature: 'No Reply Pressure', angelia: true, groupChat: false },
];

export function ComparisonTable() {
  const { theme } = useTheme();

  return (
    <View style={[styles.table, { borderColor: theme.border }]}>
      <View style={[styles.headerRow, { backgroundColor: theme.secondary }]}>
        <Text
          style={[
            styles.headerCell,
            styles.featureCol,
            { color: theme.secondaryForeground },
          ]}
        >
          Feature
        </Text>
        <Text
          style={[
            styles.headerCell,
            styles.valueCol,
            { color: theme.secondaryForeground },
          ]}
        >
          Angelia
        </Text>
        <Text
          style={[
            styles.headerCell,
            styles.valueCol,
            { color: theme.secondaryForeground },
          ]}
        >
          Group Chat
        </Text>
      </View>
      {COMPARISONS.map((row) => (
        <View
          key={row.feature}
          style={[styles.row, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[styles.cell, styles.featureCol, { color: theme.foreground }]}
          >
            {row.feature}
          </Text>
          <Text style={[styles.cell, styles.valueCol]}>
            {row.angelia ? '✅' : '❌'}
          </Text>
          <Text style={[styles.cell, styles.valueCol]}>
            {row.groupChat ? '✅' : '❌'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 13,
    fontWeight: '600',
  },
  cell: {
    fontSize: 13,
  },
  featureCol: {
    flex: 2,
  },
  valueCol: {
    flex: 1,
    textAlign: 'center',
  },
});
