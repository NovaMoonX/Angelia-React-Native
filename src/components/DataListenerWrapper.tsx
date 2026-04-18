import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { setPosts } from '@/store/slices/postsSlice';
import { setChannels } from '@/store/slices/channelsSlice';
import { setCurrentUser, setUsers, setCurrentUserNotificationSettings } from '@/store/slices/usersSlice';
import {
  setIncomingRequests,
  setOutgoingRequests,
} from '@/store/slices/invitesSlice';
import { processPendingInvite } from '@/store/actions/inviteActions';
import { initNotifications } from '@/store/actions/notificationActions';
import {
  subscribeToCurrentUser,
  subscribeToChannels,
  subscribeToPosts,
  subscribeToIncomingJoinRequests,
  subscribeToOutgoingJoinRequests,
  subscribeToChannelUsers,
  subscribeToNotificationSettings,
} from '@/services/firebase/firestore';
import {
  requestNotificationPermission,
  NOTIFICATION_ID,
  getFollowUpForPrompt,
} from '@/services/notifications';
import type { AppNotificationType, Channel, ChannelJoinRequest, NotificationSettings, Post, User } from '@/models/types';

interface DataListenerWrapperProps {
  children: React.ReactNode;
}

/**
 * Module-level set that tracks notification response keys we've already acted
 * on.  Using module scope (instead of a React ref) prevents re-processing the
 * same notification after a logout/login cycle that remounts this component.
 */
const handledNotificationKeys = new Set<string>();

function getNotificationKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}_${response.notification.date}`;
}

export function DataListenerWrapper({ children }: DataListenerWrapperProps) {
  const dispatch = useAppDispatch();
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const channels = useAppSelector((state) => state.channels.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const pendingInviteChannel = useAppSelector((state) => state.pendingInvite.channel);

  const unsubsRef = useRef<Array<() => void>>([]);
  const postsUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const notifSettingsUnsubRef = useRef<(() => void) | null>(null);
  const pendingInviteProcessed = useRef(false);
  /**
   * Guards against concurrent initNotifications dispatches.  Set to true while
   * any initNotifications thunk is in flight so that the Firestore subscription
   * callback (Effect 6) does not trigger a second init when the document does
   * not yet exist.
   */
  const notifInitInFlight = useRef(false);

  // Effect 1: Auth state — subscribe to user, channels, join requests
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;

    const unsubUser = subscribeToCurrentUser(uid, (user: User | null) => {
      dispatch(setCurrentUser(user));
    });

    const unsubChannels = subscribeToChannels(uid, (ch: Channel[]) => {
      dispatch(setChannels(ch));
    });

    const unsubIncoming = subscribeToIncomingJoinRequests(
      uid,
      (reqs: ChannelJoinRequest[]) => {
        dispatch(setIncomingRequests(reqs));
      }
    );

    const unsubOutgoing = subscribeToOutgoingJoinRequests(
      uid,
      (reqs: ChannelJoinRequest[]) => {
        dispatch(setOutgoingRequests(reqs));
      }
    );

    unsubsRef.current = [unsubUser, unsubChannels, unsubIncoming, unsubOutgoing];

    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];
    };
  }, [firebaseUser, isDemo, dispatch]);

  // Effect 2: Channel changes → re-subscribe to posts
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length === 0) return;

    if (postsUnsubRef.current) {
      postsUnsubRef.current();
    }

    postsUnsubRef.current = subscribeToPosts(
      uid,
      channelIds,
      (posts: Post[]) => {
        dispatch(setPosts(posts));
      }
    );

    return () => {
      if (postsUnsubRef.current) {
        postsUnsubRef.current();
        postsUnsubRef.current = null;
      }
    };
  }, [firebaseUser, isDemo, channels, dispatch]);

  // Effect 3: User set changes → re-subscribe to channel users
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const userIds = new Set<string>();
    channels.forEach((ch) => {
      userIds.add(ch.ownerId);
      ch.subscribers.forEach((s) => userIds.add(s));
    });

    const uniqueIds = Array.from(userIds);
    if (uniqueIds.length === 0) return;

    if (usersUnsubRef.current) {
      usersUnsubRef.current();
    }

    usersUnsubRef.current = subscribeToChannelUsers(
      uniqueIds,
      (users: User[]) => {
        dispatch(setUsers(users));
      }
    );

    return () => {
      if (usersUnsubRef.current) {
        usersUnsubRef.current();
        usersUnsubRef.current = null;
      }
    };
  }, [firebaseUser, isDemo, channels, dispatch]);

  // Effect 4: Process pending invite once user is authenticated
  useEffect(() => {
    if (!pendingInviteChannel || !currentUser || pendingInviteProcessed.current) return;
    pendingInviteProcessed.current = true;

    dispatch(processPendingInvite())
      .unwrap()
      .then((result) => {
        if (result) {
          addToast({ type: 'success', title: 'Join request sent!' });
        }
      })
      .catch(() => {
        pendingInviteProcessed.current = false;
        addToast({ type: 'error', title: 'Failed to send join request' });
      });
  }, [pendingInviteChannel, currentUser, dispatch, addToast]);

  // Effect 5: Initialise notifications once user profile is ready.
  // Always called on login and on app launch so local notifications are
  // re-scheduled even after app reinstalls or OS-level clearing.
  // Permission is requested in parallel but never blocks settings init so the
  // UI always loads even on simulators or devices where FCM is unavailable.
  useEffect(() => {
    if (isDemo || !firebaseUser || !currentUser) return;

    requestNotificationPermission().catch(() => {}); // fire-and-forget
    notifInitInFlight.current = true;
    dispatch(initNotifications()).finally(() => {
      notifInitInFlight.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, !!currentUser, isDemo]);

  // Effect 6: Subscribe to notification settings changes in Firestore.
  // If the document is absent (e.g. after an app reinstall clears Firestore
  // cache, or if the doc was deleted) and we are not already initialising,
  // trigger initNotifications to re-create it with default values.
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;

    if (notifSettingsUnsubRef.current) {
      notifSettingsUnsubRef.current();
    }

    notifSettingsUnsubRef.current = subscribeToNotificationSettings(
      uid,
      (settings: NotificationSettings | null) => {
        dispatch(setCurrentUserNotificationSettings(settings));
        if (!settings && !notifInitInFlight.current) {
          notifInitInFlight.current = true;
          dispatch(initNotifications()).finally(() => {
            notifInitInFlight.current = false;
          });
        }
      },
    );

    return () => {
      if (notifSettingsUnsubRef.current) {
        notifSettingsUnsubRef.current();
        notifSettingsUnsubRef.current = null;
      }
    };
  }, [firebaseUser, isDemo, dispatch]);

  // Effect 7: Handle notification press while app is in foreground
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const notification = response.notification;
        if (notification.request.identifier !== NOTIFICATION_ID) return;
        const key = getNotificationKey(response);
        if (handledNotificationKeys.has(key)) return;
        handledNotificationKeys.add(key);
        const promptIndex = parseInt(
          (notification.request.content.data?.promptIndex as string) ?? '0',
          10,
        );
        const followUp = getFollowUpForPrompt(promptIndex);
        router.push({
          pathname: '/(protected)/post/new',
          params: { notificationPrompt: followUp },
        });
      },
    );
    return () => subscription.remove();
  }, []);

  // Effect 8: Handle notification that launched the app from a quit/killed state
  useEffect(() => {
    if (!currentUser) return;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (
          response &&
          response.notification.request.identifier === NOTIFICATION_ID
        ) {
          const key = getNotificationKey(response);
          if (handledNotificationKeys.has(key)) return;
          handledNotificationKeys.add(key);
          const promptIndex = parseInt(
            (response.notification.request.content.data?.promptIndex as string) ?? '0',
            10,
          );
          const followUp = getFollowUpForPrompt(promptIndex);
          router.push({
            pathname: '/(protected)/post/new',
            params: { notificationPrompt: followUp },
          });
        }
      })
      .catch(() => {
        // Notification initial-launch check is best-effort; ignore errors
      });
  // Run once when the user profile first becomes available after app start
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Effect 9: Show in-app toast when a push notification arrives in the foreground.
  // Handles join_channel_request and join_channel_accepted types.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string> | undefined;
      const type = data?.type as AppNotificationType | undefined;

      if (type === 'join_channel_request') {
        const channelName = data?.channelName ?? 'your channel';
        const firstName = data?.requesterFirstName ?? 'Someone';
        const joinRequestId = data?.joinRequestId;
        addToast({
          type: 'info',
          title: `📬 ${firstName} wants to join!`,
          description: `Tap to review their request for ${channelName}`,
          onPress: joinRequestId
            ? () => router.push({ pathname: '/(protected)/join-request/[id]', params: { id: joinRequestId } })
            : undefined,
        });
      } else if (type === 'join_channel_accepted') {
        const channelName = data?.channelName ?? 'the channel';
        addToast({
          type: 'success',
          title: '🎉 You\'ve been accepted!',
          description: `Tap to check out ${channelName} and celebrate!`,
          onPress: () => router.push({ pathname: '/(protected)/channel-accepted', params: { channelName } }),
        });
      }
    });
    return () => subscription.remove();
  }, [addToast]);

  return <>{children}</>;
}
