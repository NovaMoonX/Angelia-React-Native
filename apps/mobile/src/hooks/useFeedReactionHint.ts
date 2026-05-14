import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FEED_REACTION_HINT_DISMISSED_KEY,
  FEED_REACTION_HINT_USED_KEY,
} from '@/models/constants';

interface UseFeedReactionHintResult {
  showFeedReactionHint: boolean;
  dismissFeedReactionHint: () => Promise<void>;
  markFeedReactionHintUsed: () => Promise<void>;
}

export function useFeedReactionHint(currentUserId: string | null | undefined): UseFeedReactionHintResult {
  const [showFeedReactionHint, setShowFeedReactionHint] = useState(false);

  useEffect(() => {
    const userId = currentUserId ?? null;
    if (!userId) {
      setShowFeedReactionHint(false);
      return;
    }

    let isMounted = true;
    void AsyncStorage.multiGet([
      FEED_REACTION_HINT_DISMISSED_KEY(userId),
      FEED_REACTION_HINT_USED_KEY(userId),
    ]).then((pairs) => {
      if (!isMounted) return;
      const valuesByKey = new Map(pairs);
      const dismissed = valuesByKey.get(FEED_REACTION_HINT_DISMISSED_KEY(userId)) === 'true';
      const used = valuesByKey.get(FEED_REACTION_HINT_USED_KEY(userId)) === 'true';
      setShowFeedReactionHint(!dismissed && !used);
    }).catch(() => {
      if (!isMounted) return;
      setShowFeedReactionHint(false);
    });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const dismissFeedReactionHint = useCallback(async () => {
    const userId = currentUserId ?? null;
    setShowFeedReactionHint(false);
    if (!userId) return;
    await AsyncStorage.setItem(FEED_REACTION_HINT_DISMISSED_KEY(userId), 'true').catch(() => {});
  }, [currentUserId]);

  const markFeedReactionHintUsed = useCallback(async () => {
    const userId = currentUserId ?? null;
    setShowFeedReactionHint(false);
    if (!userId) return;
    await AsyncStorage.setItem(FEED_REACTION_HINT_USED_KEY(userId), 'true').catch(() => {});
  }, [currentUserId]);

  return {
    showFeedReactionHint,
    dismissFeedReactionHint,
    markFeedReactionHintUsed,
  };
}