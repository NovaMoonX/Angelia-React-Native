import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const COMPARISONS = [
  { useCase: 'Quick coordination', groupChat: true, socialMedia: false, angelia: false },
  { useCase: 'Share once, reach everyone', groupChat: false, socialMedia: true, angelia: true },
  { useCase: 'Organized updates', groupChat: false, socialMedia: true, angelia: true },
  { useCase: 'Private & family-focused', groupChat: true, socialMedia: false, angelia: true },
  { useCase: 'Join topic Circles', groupChat: false, socialMedia: false, angelia: true },
  { useCase: 'Temporary updates', groupChat: false, socialMedia: false, angelia: true },
  { useCase: 'No algorithm distraction', groupChat: true, socialMedia: false, angelia: true },
  { useCase: 'Share life updates', groupChat: true, socialMedia: true, angelia: true },
];

export function ComparisonTable() {
  const { theme } = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.table, { borderColor: theme.border }]}>
        <View style={[styles.headerRow, { backgroundColor: theme.secondary }]}>
          <Text
            style={[
              styles.headerCell,
              styles.featureCol,
              { color: theme.secondaryForeground },
            ]}
          >
            Use Case
          </Text>
          <Text
            style={[
              styles.headerCell,
              styles.valueCol,
              { color: theme.secondaryForeground },
            ]}
          >
            Group Chats
          </Text>
          <Text
            style={[
              styles.headerCell,
              styles.valueCol,
              { color: theme.secondaryForeground },
            ]}
          >
            Social Media
          </Text>
          <Text
            style={[
              styles.headerCell,
              styles.valueCol,
              { color: theme.primary },
            ]}
          >
            Angelia
          </Text>
        </View>
        {COMPARISONS.map((row) => (
          <View
            key={row.useCase}
            style={[styles.row, { borderBottomColor: theme.border }]}
          >
            <Text
              style={[styles.cell, styles.featureCol, { color: theme.foreground }]}
            >
              {row.useCase}
            </Text>
            <Text style={[styles.cell, styles.valueCol]}>
              {row.groupChat ? '✅' : '◯'}
            </Text>
            <Text style={[styles.cell, styles.valueCol]}>
              {row.socialMedia ? '✅' : '◯'}
            </Text>
            <Text style={[styles.cell, styles.valueCol]}>
              {row.angelia ? '✅' : '◯'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.footnote, { color: theme.mutedForeground }]}>
        Angelia doesn't replace group chats or social media — it fills the gap
        for intentional family connection.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  table: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '600',
  },
  cell: {
    fontSize: 11,
  },
  featureCol: {
    flex: 2.5,
  },
  valueCol: {
    flex: 1,
    textAlign: 'center',
  },
  footnote: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
});
