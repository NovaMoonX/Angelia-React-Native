import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PRIVATE_NOTE_CONVERSATIONS_NOTICE_ACCENT } from '@/models/constants';

interface PrivateNoteConversationsNoticeProps {
  onDismiss: () => void;
}

export function PrivateNoteConversationsNotice({ onDismiss }: PrivateNoteConversationsNoticeProps) {
  const accent = PRIVATE_NOTE_CONVERSATIONS_NOTICE_ACCENT;

  return (
    <View
      style={[
        styles.noticeCard,
        {
          backgroundColor: `${accent}1F`,
          borderColor: `${accent}66`,
        },
      ]}
    >
      <View style={styles.noticeContent}>
        <Text style={[styles.noticeEmoji, { color: accent }]}>💌</Text>
        <View style={styles.noticeTextWrap}>
          <Text style={[styles.noticeTitle, { color: accent }]}>Replies are here!</Text>
          <Text style={[styles.noticeBody, { color: accent }]}>
            Tap any private note to keep the conversation going with a back-and-forth thread.
          </Text>
        </View>
      </View>
      <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismissButton}>
        <Feather name="x" size={18} color={accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 8,
  },
  noticeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  noticeTextWrap: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  dismissButton: {
    paddingTop: 2,
  },
});
