import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PRIVATE_NOTE_CONVERSATIONS_NOTICE_SEEN_KEY,
  PRIVATE_NOTE_CONVERSATIONS_NOTICE_VERSION,
} from '@/models/constants';

export function usePrivateNoteConversationsNotice(): {
  showNotice: boolean;
  dismissNotice: () => void;
} {
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const noticeKey = PRIVATE_NOTE_CONVERSATIONS_NOTICE_SEEN_KEY(
      PRIVATE_NOTE_CONVERSATIONS_NOTICE_VERSION,
    );

    void AsyncStorage.getItem(noticeKey)
      .then((seen) => {
        setShowNotice(seen !== 'true');
      })
      .catch(() => {
        setShowNotice(true);
      });
  }, []);

  const dismissNotice = useCallback(() => {
    setShowNotice(false);
    const noticeKey = PRIVATE_NOTE_CONVERSATIONS_NOTICE_SEEN_KEY(
      PRIVATE_NOTE_CONVERSATIONS_NOTICE_VERSION,
    );
    void AsyncStorage.setItem(noticeKey, 'true');
  }, []);

  return { showNotice, dismissNotice };
}
