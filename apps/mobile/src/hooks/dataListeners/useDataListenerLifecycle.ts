import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppDispatch } from '@/store/hooks';
import { resumeQueuedPostUploads } from '@/store/actions/postActions';
import {
  ensurePostUploadTaskDefined,
  setPostUploadResumeHandler,
} from '@/services/uploads/postUploadTask';
import { APP_LAST_OPENED_AT_KEY, FEED_SESSION_SCROLLED_KEY } from '@/models/constants';

interface UseDataListenerLifecycleParams {
  currentUserId: string | null;
  hasFirebaseUser: boolean;
  isDemo: boolean;
}

export function useDataListenerLifecycle({
  currentUserId,
  hasFirebaseUser,
  isDemo,
}: UseDataListenerLifecycleParams) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const writeLastOpened = async () => {
      await AsyncStorage.setItem(APP_LAST_OPENED_AT_KEY(currentUserId), String(Date.now())).catch((error) => {
        console.warn('Failed to persist app last opened timestamp', error);
      });
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }
      void writeLastOpened();
    };

    void writeLastOpened();

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (isDemo || !hasFirebaseUser) {
      return;
    }

    void dispatch(resumeQueuedPostUploads());
  }, [dispatch, hasFirebaseUser, isDemo]);

  useEffect(() => {
    ensurePostUploadTaskDefined();
    setPostUploadResumeHandler(async () => {
      if (isDemo || !hasFirebaseUser) {
        return;
      }
      await dispatch(resumeQueuedPostUploads()).unwrap();
    });

    return () => {
      setPostUploadResumeHandler(null);
    };
  }, [dispatch, hasFirebaseUser, isDemo]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        void AsyncStorage.removeItem(FEED_SESSION_SCROLLED_KEY);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
