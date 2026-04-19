import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { setPosts } from '@/store/slices/postsSlice';
import { setChannels, setConnectionChannels } from '@/store/slices/channelsSlice';
import { setCurrentUser, setUsers, setCurrentUserNotificationSettings } from '@/store/slices/usersSlice';
import {
  setIncomingRequests,
  setOutgoingRequests,
} from '@/store/slices/invitesSlice';
import {
  setConnections,
  setIncomingConnectionRequests,
  setOutgoingConnectionRequests,
} from '@/store/slices/connectionsSlice';
import { processPendingInvite } from '@/store/actions/inviteActions';
import { processPendingConnection } from '@/store/actions/connectionsActions';
import { initNotifications } from '@/store/actions/notificationActions';
import {
  subscribeToCurrentUser,
  subscribeToChannels,
  subscribeToPosts,
  subscribeToIncomingJoinRequests,
  subscribeToOutgoingJoinRequests,
  subscribeToChannelUsers,
  subscribeToNotificationSettings,
  subscribeToConnections,
  subscribeToIncomingConnectionRequests,
  subscribeToOutgoingConnectionRequests,
  subscribeToConnectionChannels,
} from '@/services/firebase/firestore';
import {
  requestNotificationPermission,
  NOTIFICATION_ID,
  WIND_DOWN_NOTIFICATION_ID,
  getFollowUpForPrompt,
} from '@/services/notifications';
import type { AppNotificationType, Channel, ChannelJoinRequest, Connection, ConnectionRequest, NotificationSettings, Post, User } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';

/** AsyncStorage key that tracks the calendar date when the daily in-app notice was last shown. */
const DAILY_PROMPT_SHOWN_DATE_KEY = '@angelia/daily_prompt_shown_date';

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
  const pendingFromUserId = useAppSelector((state) => state.connections.pendingFromUserId);
  const connections = useAppSelector((state) => state.connections.connections);
  const posts = useAppSelector((state) => state.posts.items);

  const unsubsRef = useRef<Array<() => void>>([]);
  const postsUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const notifSettingsUnsubRef = useRef<(() => void) | null>(null);
  const connectionChannelsUnsubRef = useRef<(() => void) | null>(null);
  const pendingInviteProcessed = useRef(false);
  const pendingConnectionProcessed = useRef(false);
  /**
   * Guards against concurrent initNotifications dispatches.  Set to true while
   * any initNotifications thunk is in flight so that the Firestore subscription
   * callback (Effect 6) does not trigger a second init when the document does
   * not yet exist.
   */
  const notifInitInFlight = useRef(false);

  // Effect 1: Auth state — subscribe to user, channels, join requests, connections
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

    const unsubConnections = subscribeToConnections(uid, (conns: Connection[]) => {
      dispatch(setConnections(conns));
    });

    const unsubIncomingConns = subscribeToIncomingConnectionRequests(
      uid,
      (reqs: ConnectionRequest[]) => {
        dispatch(setIncomingConnectionRequests(reqs));
      },
    );

    const unsubOutgoingConns = subscribeToOutgoingConnectionRequests(
      uid,
      (reqs: ConnectionRequest[]) => {
        dispatch(setOutgoingConnectionRequests(reqs));
      },
    );

    unsubsRef.current = [
      unsubUser,
      unsubChannels,
      unsubIncoming,
      unsubOutgoing,
      unsubConnections,
      unsubIncomingConns,
      unsubOutgoingConns,
    ];

    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];
    };
  }, [firebaseUser, isDemo, dispatch]);

  // Effect 2: Channel changes → re-subscribe to posts
  // Includes connected users' daily channel IDs so their posts appear in the feed.
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const ownChannelIds = channels.map((c) => c.id);
    const connectedDailyIds = connections
      .map((c) => `${c.userId}${DAILY_CHANNEL_SUFFIX}`)
      .filter((id) => !ownChannelIds.includes(id));
    const channelIds = [...ownChannelIds, ...connectedDailyIds];

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
  }, [firebaseUser, isDemo, channels, connections, dispatch]);

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

  // Effect 4b: Process pending connection request once user is authenticated
  useEffect(() => {
    if (!pendingFromUserId || !currentUser || pendingConnectionProcessed.current) return;
    pendingConnectionProcessed.current = true;

    dispatch(processPendingConnection())
      .unwrap()
      .then((result) => {
        if (result) {
          addToast({ type: 'success', title: 'Connection request sent! 🤝' });
        }
      })
      .catch(() => {
        pendingConnectionProcessed.current = false;
        addToast({ type: 'error', title: 'Failed to send connection request' });
      });
  }, [pendingFromUserId, currentUser, dispatch, addToast]);

  // Effect 4c: Connections change → subscribe to connected users' daily channels
  // so channel metadata is available for rendering their posts in the feed.
  useEffect(() => {
    if (isDemo || !firebaseUser || connections.length === 0) {
      if (connectionChannelsUnsubRef.current) {
        connectionChannelsUnsubRef.current();
        connectionChannelsUnsubRef.current = null;
      }
      return;
    }

    if (connectionChannelsUnsubRef.current) {
      connectionChannelsUnsubRef.current();
    }

    const connectedUserIds = connections.map((c) => c.userId);
    connectionChannelsUnsubRef.current = subscribeToConnectionChannels(
      connectedUserIds,
      (connChannels: Channel[]) => {
        dispatch(setConnectionChannels(connChannels));
      },
    );

    return () => {
      if (connectionChannelsUnsubRef.current) {
        connectionChannelsUnsubRef.current();
        connectionChannelsUnsubRef.current = null;
      }
    };
  // connections.length guards the empty-case fast path; the full reconnect
  // on id changes is covered by the stable serialised key below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, isDemo, connections.length,
    // Stable key: only changes when the set of connected user IDs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    connections.map((c) => c.userId).sort().join(',')]);

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
  // Handles join_channel_request, join_channel_accepted, connection_request,
  // connection_accepted, and big_news_post types.
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
      } else if (type === 'connection_request') {
        const firstName = data?.fromFirstName ?? 'Someone';
        const requestId = data?.connectionRequestId;
        addToast({
          type: 'info',
          title: `🤝 ${firstName} wants to connect!`,
          description: 'Tap to review their connection request',
          onPress: requestId
            ? () => router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: requestId } })
            : () => router.push('/(protected)/notifications'),
        });
      } else if (type === 'connection_accepted') {
        const firstName = data?.toFirstName ?? 'Someone';
        addToast({
          type: 'success',
          title: `🎉 You're connected with ${firstName}!`,
          description: 'Tap to see your people',
          onPress: () => router.push('/(protected)/my-people'),
        });
      } else if (type === 'big_news_post') {
        const firstName = data?.authorFirstName ?? 'Someone';
        const lastName = data?.authorLastName ?? '';
        const postId = data?.postId;
        const isDaily = data?.isDaily === 'true';
        const circleLabel = isDaily ? 'Daily Circle' : 'circle';
        addToast({
          type: 'info',
          title: `🌟 Big news from ${firstName} ${lastName}`.trim() + '!',
          description: `Tap to see their ${circleLabel} update`,
          onPress: postId
            ? () => router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } })
            : undefined,
        });
      }
    });
    return () => subscription.remove();
  }, [addToast]);

  // Effect 10: Handle daily prompt notifications that arrive while the app is
  // in the foreground.  The system banner is suppressed by setNotificationHandler
  // in _layout.tsx; here we decide whether to show an in-app notice instead.
  //
  // Rules (all must pass to show the in-app notice):
  //   1. The notification is a daily prompt (NOTIFICATION_ID or WIND_DOWN_NOTIFICATION_ID).
  //   2. The current user has NOT already made a post today.
  //   3. We have NOT already shown the in-app notice today (checked via AsyncStorage).
  //
  // When shown, we store today's date in AsyncStorage so we don't repeat it.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const identifier = notification.request.identifier;
      if (identifier !== NOTIFICATION_ID && identifier !== WIND_DOWN_NOTIFICATION_ID) return;
      if (!currentUser) return;

      const today = new Date().toDateString();

      // Check if user has already posted today (synchronous Redux check)
      const hasPostedToday = posts.some(
        (p) => p.authorId === currentUser.id && new Date(p.timestamp).toDateString() === today,
      );
      if (hasPostedToday) return;

      // Async check for whether the in-app notice was already shown today
      void (async () => {
        try {
          const shownDate = await AsyncStorage.getItem(DAILY_PROMPT_SHOWN_DATE_KEY);
          if (shownDate === today) return;

          // Mark as shown before displaying so a rapid double-fire is handled
          await AsyncStorage.setItem(DAILY_PROMPT_SHOWN_DATE_KEY, today);

          const body = notification.request.content.body ?? "What's going on today? ✨";
          addToast({
            type: 'info',
            title: '✨ Time to share!',
            description: body,
            onPress: () =>
              router.push({
                pathname: '/(protected)/post/new',
                params: { notificationPrompt: getFollowUpForPrompt(0) },
              }),
          });
        } catch {
          // AsyncStorage failure is non-fatal — silently skip the in-app notice
        }
      })();
    });
    return () => subscription.remove();
  // Re-create when user or posts change so the hasPostedToday check is fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, posts, addToast]);

  return <>{children}</>;
}
