import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { setPosts } from '@/store/slices/postsSlice';
import { setChannels, setConnectionChannels, syncDailyChannelMembers } from '@/store/slices/channelsSlice';
import { setCurrentUser, setUsers, setCurrentUserNotificationSettings } from '@/store/slices/usersSlice';
import {
  setIncomingRequests,
  setOutgoingRequests,
  setIncomingCircleInvites,
  setOutgoingCircleInvites,
} from '@/store/slices/invitesSlice';
import { setTasks } from '@/store/slices/tasksSlice';
import {
  setConnections,
  setIncomingConnectionRequests,
  setOutgoingConnectionRequests,
} from '@/store/slices/connectionsSlice';
import { selectAllChannels, selectUserDailyChannel } from '@/store/slices/channelsSlice';
import { processPendingInvite } from '@/store/actions/inviteActions';
import { processPendingConnection } from '@/store/actions/connectionsActions';
import { initNotifications } from '@/store/actions/notificationActions';
import { resumeQueuedPostUploads } from '@/store/actions/postActions';
import {
  subscribeToCurrentUser,
  subscribeToChannels,
  subscribeToPosts,
  subscribeToIncomingJoinRequests,
  subscribeToOutgoingJoinRequests,
  subscribeToIncomingCircleInviteRequests,
  subscribeToOutgoingCircleInviteRequests,
  subscribeToChannelUsers,
  subscribeToNotificationSettings,
  subscribeToConnections,
  subscribeToIncomingConnectionRequests,
  subscribeToOutgoingConnectionRequests,
  subscribeToConnectionChannels,
  subscribeToTasks,
} from '@/services/firebase/firestore';
import {
  requestNotificationPermission,
  NOTIFICATION_ID,
  WIND_DOWN_NOTIFICATION_ID,
  getFollowUpForPrompt,
  dismissNotificationsByData,
} from '@/services/notifications';
import {
  ensurePostUploadTaskDefined,
  setPostUploadResumeHandler,
} from '@/services/uploads/postUploadTask';
import { APP_LAST_OPENED_AT_KEY, FEED_SESSION_SCROLLED_KEY } from '@/models/constants';
import type { AppNotificationType, Channel, ChannelJoinRequest, Connection, ConnectionRequest, NotificationSettings, Post, User } from '@/models/types';

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
const handledForegroundToastKeys = new Set<string>();

function logNotificationRoute(event: string, details?: Record<string, unknown>) {
  if (!__DEV__) {
    return;
  }
  if (details) {
    console.log(`[NotificationRoute] ${event}`, details);
    return;
  }
  console.log(`[NotificationRoute] ${event}`);
}

function getNotificationKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}_${response.notification.date}`;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') {
      out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function extractNotificationData(notification: Notifications.Notification): Record<string, string> | undefined {
  const contentData = toStringRecord(notification.request.content.data);
  if (contentData && Object.keys(contentData).length > 0) {
    return contentData;
  }

  // iOS push notifications can place custom keys inside trigger.payload.
  const triggerAny = notification.request.trigger as unknown as { payload?: unknown } | null;
  const payload = triggerAny?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const payloadRecord = payload as Record<string, unknown>;
  const nestedData = toStringRecord(payloadRecord.data);
  if (nestedData && Object.keys(nestedData).length > 0) {
    return nestedData;
  }

  return toStringRecord(payloadRecord);
}

function getForegroundToastKey(notification: Notifications.Notification): string {
  const data = extractNotificationData(notification);
  const type = data?.type ?? 'unknown';
  const uniqueId =
    data?.joinRequestId ??
    data?.requestId ??
    data?.connectionRequestId ??
    data?.postId ??
    notification.request.identifier;
  return `${type}_${uniqueId}_${notification.date}`;
}

export function DataListenerWrapper({ children }: DataListenerWrapperProps) {
  const dispatch = useAppDispatch();
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const channels = useAppSelector(selectAllChannels);
  const connectionChannels = useAppSelector((state) => state.channels.connectionChannels);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const allUsers = useAppSelector((state) => state.users.users);
  const pendingInviteChannel = useAppSelector((state) => state.pendingInvite.channel);
  const pendingFromUserId = useAppSelector((state) => state.connections.pendingFromUserId);
  const connections = useAppSelector((state) => state.connections.connections);
  const incomingConnectionRequests = useAppSelector((state) => state.connections.incomingRequests);
  const incomingJoinRequests = useAppSelector((state) => state.invites.incoming);
  const incomingCircleInvites = useAppSelector((state) => state.invites.incomingCircleInvites);
  const posts = useAppSelector((state) => state.posts.items);

  // Whether the current user's daily channel is loaded — used to trigger the member sync
  // when channels arrive after connections (race-condition safety).
  const uid = firebaseUser?.uid ?? '';
  const myDailyChannelId = useAppSelector(
    (state) => selectUserDailyChannel(state, uid)?.id ?? null,
  );

  // Refs used by Effect 10 so the listener isn't re-created on every post change.
  const currentUserRef = useRef(currentUser);
  const postsRef = useRef(posts);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  // Refs used by Effects 12 & 13 for Firestore-sourced in-app notification detection.
  // Tracks which request IDs have already triggered an in-app toast (deduplicates
  // against push-notification toasts from Effect 9).
  const seenConnectionRequestIdsRef = useRef(new Set<string>());
  const connectionRequestsLoadedRef = useRef(false);
  const seenJoinRequestIdsRef = useRef(new Set<string>());
  const joinRequestsLoadedRef = useRef(false);
  const seenCircleInviteIdsRef = useRef(new Set<string>());
  const circleInvitesLoadedRef = useRef(false);

  const unsubsRef = useRef<Array<() => void>>([]);
  const postsUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const notifSettingsUnsubRef = useRef<(() => void) | null>(null);
  const connectionChannelsUnsubRef = useRef<(() => void) | null>(null);
  const tasksUnsubRef = useRef<(() => void) | null>(null);
  const pendingInviteProcessed = useRef(false);
  const pendingConnectionProcessed = useRef(false);
  const ownPostStatusRef = useRef<Record<string, Post['status']>>({});
  const ownPostStatusInitializedRef = useRef(false);

  /**
   * Guards against concurrent initNotifications dispatches.  Set to true while
   * any initNotifications thunk is in flight so that the Firestore subscription
   * callback (Effect 6) does not trigger a second init when the document does
   * not yet exist.
   */
  const notifInitInFlight = useRef(false);

  const routeFromNotificationPayload = useRef((
    type: string | undefined,
    data: Record<string, string> | undefined,
    source: 'cold-start' | 'foreground-listener',
  ) => {
    logNotificationRoute('routeFromNotificationPayload:start', {
      source,
      type: type ?? 'undefined',
      postId: data?.postId,
      joinRequestId: data?.joinRequestId,
      requestId: data?.requestId,
      connectionRequestId: data?.connectionRequestId,
      platform: Platform.OS,
    });

    if (type === 'join_channel_request') {
      const joinRequestId = data?.joinRequestId;
      if (joinRequestId) {
        logNotificationRoute('navigate:join_request', { source, joinRequestId });
        router.push({ pathname: '/(protected)/join-request/[id]', params: { id: joinRequestId } });
      } else {
        logNotificationRoute('navigate:notifications_fallback', { source, type });
        router.push('/(protected)/notifications');
      }
      return;
    }

    if (type === 'join_channel_accepted') {
      const channelName = data?.channelName ?? '';
      logNotificationRoute('navigate:join_channel_accepted', { source, channelName });
      router.push({ pathname: '/(protected)/channel-accepted', params: { channelName } });
      return;
    }

    if (type === 'custom_circle_invite') {
      const requestId = data?.requestId;
      if (requestId) {
        logNotificationRoute('navigate:circle_invite', { source, requestId });
        router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: requestId } } as never);
      } else {
        logNotificationRoute('navigate:notifications_fallback', { source, type });
        router.push('/(protected)/notifications');
      }
      return;
    }

    if (type === 'connection_request') {
      const requestId = data?.connectionRequestId;
      if (requestId) {
        logNotificationRoute('navigate:connection_request', { source, requestId });
        router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: requestId } });
      } else {
        logNotificationRoute('navigate:notifications_fallback', { source, type });
        router.push('/(protected)/notifications');
      }
      return;
    }

    if (type === 'connection_accepted') {
      logNotificationRoute('navigate:my_people', { source });
      router.push('/(protected)/my-people');
      return;
    }

    if (type === 'new_post' || type === 'post_reaction') {
      const postId = data?.postId;
      if (postId) {
        if (type === 'post_reaction') {
          void dismissNotificationsByData({ type: 'post_reaction', postId });
        }
        logNotificationRoute('navigate:post_detail', { source, postId, type });
        router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } });
      }
      return;
    }

    if (type === 'conversation_message' || type === 'comment_reply') {
      const postId = data?.postId;
      if (postId) {
        void dismissNotificationsByData({ type, postId });
        logNotificationRoute('navigate:conversation', { source, postId, type });
        router.push({ pathname: '/(protected)/conversation', params: { postId } });
      }
      return;
    }

    if (type === 'private_note') {
      const postId = data?.postId;
      if (postId) {
        void dismissNotificationsByData({ type: 'private_note', postId });
        logNotificationRoute('navigate:private_notes_host', { source, postId });
        router.push({ pathname: '/(protected)/private-notes-host/[postId]', params: { postId } });
      }
      return;
    }

    logNotificationRoute('routeFromNotificationPayload:ignored', {
      source,
      type: type ?? 'undefined',
    });
  });

  // Effect 0: Track local "last app open" timestamp for the signed-in user.
  useEffect(() => {
    const currentUserId = currentUser?.id ?? null;
    if (!currentUserId) return;

    const writeLastOpened = async () => {
      await AsyncStorage.setItem(APP_LAST_OPENED_AT_KEY(currentUserId), String(Date.now())).catch((error) => {
        console.warn('Failed to persist app last opened timestamp', error);
      });
    };
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      void writeLastOpened();
    };

    void writeLastOpened();

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, [currentUser?.id]);

  // Effect 1: Auth state — subscribe to user, channels, join requests, connections
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;

    // Reset Firestore-sourced notification tracking on each auth session so
    // we don't show stale toasts when the user logs out and back in.
    seenConnectionRequestIdsRef.current = new Set();
    connectionRequestsLoadedRef.current = false;
    seenJoinRequestIdsRef.current = new Set();
    joinRequestsLoadedRef.current = false;
    seenCircleInviteIdsRef.current = new Set();
    circleInvitesLoadedRef.current = false;
    handledForegroundToastKeys.clear();

    const unsubUser = subscribeToCurrentUser(uid, (user: User | null) => {
      dispatch(setCurrentUser(user));
    });

    const unsubChannels = subscribeToChannels(uid, (ch: Channel[]) => {
      dispatch(setChannels(ch));
    });

    const unsubIncoming = subscribeToIncomingJoinRequests(
      uid,
      (reqs: ChannelJoinRequest[]) => {
        // Record all existing IDs on the first snapshot so we don't show
        // in-app toasts for join requests that were already pending at login.
        if (!joinRequestsLoadedRef.current) {
          reqs.forEach((r) => { seenJoinRequestIdsRef.current.add(r.id); });
          joinRequestsLoadedRef.current = true;
        }
        dispatch(setIncomingRequests(reqs));
      }
    );

    const unsubOutgoing = subscribeToOutgoingJoinRequests(
      uid,
      (reqs: ChannelJoinRequest[]) => {
        dispatch(setOutgoingRequests(reqs));
      }
    );

    const unsubIncomingCircleInvites = subscribeToIncomingCircleInviteRequests(
      uid,
      (reqs) => {
        if (!circleInvitesLoadedRef.current) {
          reqs.forEach((r) => { seenCircleInviteIdsRef.current.add(r.id); });
          circleInvitesLoadedRef.current = true;
        }
        dispatch(setIncomingCircleInvites(reqs));
      },
    );

    const unsubOutgoingCircleInvites = subscribeToOutgoingCircleInviteRequests(
      uid,
      (reqs) => {
        dispatch(setOutgoingCircleInvites(reqs));
      },
    );

    const unsubConnections = subscribeToConnections(uid, (conns: Connection[]) => {
      dispatch(setConnections(conns));
    });

    const unsubIncomingConns = subscribeToIncomingConnectionRequests(
      uid,
      (reqs: ConnectionRequest[]) => {
        // Record all existing IDs on the first snapshot so we don't show
        // in-app toasts for connection requests that were already pending at login.
        if (!connectionRequestsLoadedRef.current) {
          reqs.forEach((r) => { seenConnectionRequestIdsRef.current.add(r.id); });
          connectionRequestsLoadedRef.current = true;
        }
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
      unsubIncomingCircleInvites,
      unsubOutgoingCircleInvites,
    ];

    return () => {
      unsubsRef.current.forEach((unsub) => unsub());
      unsubsRef.current = [];
    };
  }, [firebaseUser, isDemo, dispatch]);

  // Resume any queued post uploads when the user is signed in.
  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }
    void dispatch(resumeQueuedPostUploads());
  }, [dispatch, firebaseUser, isDemo]);

  // Keep a TaskManager handler wired so upload queue resumption logic is
  // available whenever background tasks are triggered by the OS.
  useEffect(() => {
    ensurePostUploadTaskDefined();
    setPostUploadResumeHandler(async () => {
      if (isDemo || !firebaseUser) {
        return;
      }
      await dispatch(resumeQueuedPostUploads()).unwrap();
    });
    return () => {
      setPostUploadResumeHandler(null);
    };
  }, [dispatch, firebaseUser, isDemo]);

  // Effect 2: Channel changes → re-subscribe to posts.
  //
  // IMPORTANT — split into two separate Firestore queries:
  //   1. Own/subscribed channels  → user is owner or subscriber, so `isChannelMember`
  //      evaluates to true for every channelId in the `in` list. No rule-chaining needed.
  //   2. Connected users' daily channels → user is connected but not a member. The rule
  //      must evaluate `isConnectedToAuthorDailyChannel` for each channelId. Keeping these
  //      in a SEPARATE query (away from the owned channels) gives Firestore's list-query
  //      security evaluator a homogeneous set where the connection check is deterministic.
  //
  // Merging happens via local closure variables that are updated by whichever callback
  // fires first and combined before each `setPosts` dispatch.
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const uid = firebaseUser.uid;

    // Build the two mutually-exclusive channel ID sets.
    const connectionChannelIdSet = new Set(connectionChannels.map((c) => { return c.id; }));
    const ownChannelIds = channels
      .filter((c) => { return !connectionChannelIdSet.has(c.id); })
      .map((c) => { return c.id; });
    const connectionDailyIds = connectionChannels.map((c) => { return c.id; });

    if (ownChannelIds.length === 0 && connectionDailyIds.length === 0) {
      return;
    }

    if (postsUnsubRef.current) {
      postsUnsubRef.current();
    }

    // Local accumulator vars shared across both subscription callbacks.
    // Each callback replaces its own bucket and dispatches the merged total.
    let ownPosts: Post[] = [];
    let connectionPosts: Post[] = [];

    const dispatchMerged = () => {
      dispatch(setPosts([...ownPosts, ...connectionPosts]));
    };

    // ── Subscription 1: own / subscribed channels ──────────────────────────
    const unsubOwn = ownChannelIds.length > 0
      ? subscribeToPosts(
          uid,
          ownChannelIds,
          (posts: Post[]) => {
            ownPosts = posts;
            dispatchMerged();
          },
          (error, batch) => {
            dispatchMerged();
          },
        )
      : () => {};

    // ── Subscription 2: connected users' daily channels ────────────────────
    const unsubConnection = connectionDailyIds.length > 0
      ? subscribeToPosts(
          uid,
          connectionDailyIds,
          (posts: Post[]) => {
            connectionPosts = posts;
            dispatchMerged();
          },
          (error, batch) => {
            dispatchMerged();
          },
        )
      : () => {};

    postsUnsubRef.current = () => {
      unsubOwn();
      unsubConnection();
    };

    return () => {
      if (postsUnsubRef.current) {
        postsUnsubRef.current();
        postsUnsubRef.current = null;
      }
    };
  }, [firebaseUser, isDemo, channels, connectionChannels, dispatch]);

  // Effect 3: User set changes → re-subscribe to channel users
  // Also includes connected users so their profiles are available in usersMap
  // even when they share no circles (required by selectMyPeopleData).
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    const userIds = new Set<string>();
    channels.forEach((ch) => {
      userIds.add(ch.ownerId);
      ch.subscribers.forEach((s) => userIds.add(s));
    });
    // Include direct connections so My People can resolve their display names.
    connections.forEach((c) => userIds.add(c.userId));
    // Include pending connection request senders so the notifications and
    // connection-request screens can resolve their names and avatars.
    incomingConnectionRequests
      .filter((r) => { return r.status === 'pending'; })
      .forEach((r) => { userIds.add(r.fromId); });

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
  }, [firebaseUser, isDemo, channels, connections, incomingConnectionRequests, dispatch]);

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
          const recipient = allUsers.find((u) => u.id === result.toId);
          const toName = recipient ? ` to ${recipient.firstName}` : '';
          addToast({ type: 'success', title: `Connection request sent${toName}! 🤝` });
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
      // Clear stale connection channels so posts from disconnected users are removed
      // immediately rather than requiring an app refresh.
      dispatch(setConnectionChannels([]));
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
      (error, batch) => {},
    );

    return () => {
      if (connectionChannelsUnsubRef.current) {
        connectionChannelsUnsubRef.current();
        connectionChannelsUnsubRef.current = null;
      }
    };
  // connections.length guards the empty-case fast path; the full reconnect
  // on id changes is covered by the stable serialized key below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, isDemo, connections.length,
    // Stable key: only changes when the set of connected user IDs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    connections.map((c) => c.userId).sort().join(',')]);

  // Effect 4d: Sync the daily channel's subscriber list with connections.
  // Runs whenever the connections set changes OR when the daily channel first loads,
  // so the member count is always accurate regardless of load order.
  useEffect(() => {
    if (isDemo || !firebaseUser || !myDailyChannelId) return;
    const memberIds = connections.map((c) => c.userId);
    dispatch(syncDailyChannelMembers({ channelId: myDailyChannelId, memberIds }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, firebaseUser, myDailyChannelId, dispatch,
    // Stable key: only re-runs when the set of connected user IDs actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    connections.map((c) => c.userId).sort().join(',')]);

  // Effect 5: Initialize notifications once user profile is ready.
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
  // cache, or if the doc was deleted) and we are not already initializing,
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
        if (handledNotificationKeys.has(key)) {
          logNotificationRoute('skip:duplicate_foreground_daily_prompt', { key });
          return;
        }
        handledNotificationKeys.add(key);
        const promptIndex = parseInt(
          (notification.request.content.data?.promptIndex as string) ?? '0',
          10,
        );
        const followUp = getFollowUpForPrompt(promptIndex);
        logNotificationRoute('navigate:daily_prompt_foreground', { key, promptIndex });
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
        if (!response) return;

        const key = getNotificationKey(response);
        if (handledNotificationKeys.has(key)) {
          logNotificationRoute('skip:duplicate_cold_start_response', { key });
          return;
        }
        handledNotificationKeys.add(key);

        const notification = response.notification;
        const identifier = notification.request.identifier;
        const data = extractNotificationData(notification);
        const type = data?.type;

        logNotificationRoute('handle:cold_start_response', {
          key,
          identifier,
          type: type ?? 'undefined',
          postId: data?.postId,
        });

        if (identifier === NOTIFICATION_ID) {
          const promptIndex = parseInt((data?.promptIndex as string) ?? '0', 10);
          const followUp = getFollowUpForPrompt(promptIndex);
          logNotificationRoute('navigate:daily_prompt_cold_start', { key, promptIndex });
          router.push({ pathname: '/(protected)/post/new', params: { notificationPrompt: followUp } });
          return;
        }

        routeFromNotificationPayload.current(type, data, 'cold-start');
      })
      .catch(() => {
        // Notification initial-launch check is best-effort; ignore errors
      });
  // Run once when the user profile first becomes available after app start
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Effect 9: Show in-app toast when a push notification arrives in the foreground.
  // Handles join/channel/connection notifications plus post-activity alerts.
  //
  // For connection_request and join_channel_request, we also mark the request ID
  // as seen so that the Firestore-based Effects 12 & 13 don't show a duplicate toast.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const toastKey = getForegroundToastKey(notification);
      if (handledForegroundToastKeys.has(toastKey)) return;
      handledForegroundToastKeys.add(toastKey);
      const data = extractNotificationData(notification);
      const type = data?.type as AppNotificationType | undefined;

      if (type === 'join_channel_request') {
        const channelName = data?.channelName ?? 'your channel';
        const firstName = data?.requesterFirstName ?? 'Someone';
        const joinRequestId = data?.joinRequestId;
        // Mark as seen so the Firestore watcher (Effect 13) doesn't duplicate this toast.
        if (joinRequestId) seenJoinRequestIdsRef.current.add(joinRequestId);
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
      } else if (type === 'custom_circle_invite') {
        const channelName = data?.channelName ?? 'this Circle';
        const firstName = data?.inviterFirstName ?? 'Someone';
        const inviteCode = data?.inviteCode;
        const requestId = data?.requestId;
        if (requestId) seenCircleInviteIdsRef.current.add(requestId);
        addToast({
          type: 'info',
          title: `✨ ${firstName} invited you to join ${channelName}`,
          description: inviteCode ? 'Tap to review the invite' : 'Open notifications to view details',
          onPress: requestId
            ? () => router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: requestId } } as never)
            : () => router.push('/(protected)/notifications'),
        });
      } else if (type === 'connection_request') {
        const firstName = data?.fromFirstName ?? 'Someone';
        const requestId = data?.connectionRequestId;
        // Mark as seen so the Firestore watcher (Effect 12) doesn't duplicate this toast.
        if (requestId) seenConnectionRequestIdsRef.current.add(requestId);
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
      } else if (type === 'new_post') {
        const firstName = data?.authorFirstName ?? 'Someone';
        const lastName = data?.authorLastName ?? '';
        const name = lastName ? `${firstName} ${lastName}` : firstName;
        const postId = data?.postId;
        const isDaily = data?.isDaily === 'true';
        const channelName = data?.channelName ?? '';
        const tier = data?.tier ?? 'everyday';
        const hasAttachments = data?.hasAttachments === 'true';
        const toastTitle =
          tier === 'big-news'
            ? `🚨 Big News from ${name}`
            : tier === 'worth-knowing'
              ? `💡 Worth Knowing from ${name}`
              : `📝 ${name} shared a new post`;
        const circleDescription = isDaily
          ? 'their Daily Circle'
          : channelName
            ? `their "${channelName}" circle`
            : 'their circle';
        const attachmentText = hasAttachments ? ' with attachments' : '';

        addToast({
          type: 'info',
          title: toastTitle,
          description: `Tap to see their new post${attachmentText} in ${circleDescription}`,
          onPress: postId
            ? () => router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } })
            : undefined,
        });
      // post_reaction, conversation_message, comment_reply, and private_note notifications are
      // handled via background tap routing in _layout.tsx. When the user is
      // inside the app, they see the activity in real-time through Redux state,
      // so no in-app toast is needed for these types.
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
  // currentUser and posts are read via refs so the listener is not re-created
  // on every post update — only addToast (stable reference) is a hard dependency.
  // When shown, today's date is stored in AsyncStorage so it doesn't repeat.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const identifier = notification.request.identifier;
      if (identifier !== NOTIFICATION_ID && identifier !== WIND_DOWN_NOTIFICATION_ID) return;

      const user = currentUserRef.current;
      if (!user) return;

      const today = new Date().toDateString();

      // Synchronous Redux check via ref — no listener churn on post updates
      const hasPostedToday = postsRef.current.some(
        (p) => p.authorId === user.id && new Date(p.timestamp).toDateString() === today,
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
  }, [addToast]);

  // Effect 11: Subscribe to the current user's pending tasks.
  useEffect(() => {
    if (isDemo || !firebaseUser) return;

    tasksUnsubRef.current?.();
    tasksUnsubRef.current = subscribeToTasks(firebaseUser.uid, (tasks) => {
      dispatch(setTasks(tasks));
    });

    return () => {
      tasksUnsubRef.current?.();
      tasksUnsubRef.current = null;
    };
  }, [isDemo, firebaseUser, dispatch]);

  // Effect 12: Show in-app toasts for new pending connection requests detected via
  // the Firestore real-time listener (covers cases where the push notification was
  // not delivered, e.g. permission denied or app foregrounded after being backgrounded).
  // Deduplicates with Effect 9 (push notification path) via seenConnectionRequestIdsRef.
  useEffect(() => {
    if (isDemo || !connectionRequestsLoadedRef.current) return;

    const newRequests = incomingConnectionRequests.filter(
      (r) => { return r.status === 'pending' && !seenConnectionRequestIdsRef.current.has(r.id); },
    );

    for (const req of newRequests) {
      seenConnectionRequestIdsRef.current.add(req.id);
      const sender = allUsers.find((u) => { return u.id === req.fromId; });
      const firstName = sender?.firstName ?? 'Someone';
      addToast({
        type: 'info',
        title: `🤝 ${firstName} wants to connect!`,
        description: 'Tap to review their connection request',
        onPress: () => router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: req.id } }),
      });
    }
  }, [isDemo, incomingConnectionRequests, allUsers, addToast]);

  // Effect 13: Show in-app toasts for new pending circle join requests detected via
  // the Firestore real-time listener (same rationale as Effect 12).
  // Deduplicates with Effect 9 (push notification path) via seenJoinRequestIdsRef.
  useEffect(() => {
    if (isDemo || !joinRequestsLoadedRef.current) return;

    const newRequests = incomingJoinRequests.filter(
      (r) => { return r.status === 'pending' && !seenJoinRequestIdsRef.current.has(r.id); },
    );

    for (const req of newRequests) {
      seenJoinRequestIdsRef.current.add(req.id);
      const requester = allUsers.find((u) => { return u.id === req.requesterId; });
      const circle = channels.find((ch) => { return ch.id === req.channelId; });
      const firstName = requester?.firstName ?? 'Someone';
      const channelName = circle?.name ?? 'your circle';
      addToast({
        type: 'info',
        title: `📬 ${firstName} wants to join!`,
        description: `Tap to review their request for ${channelName}`,
        onPress: () => router.push({ pathname: '/(protected)/join-request/[id]', params: { id: req.id } }),
      });
    }
  }, [isDemo, incomingJoinRequests, allUsers, channels, addToast]);

  // Effect 14: Show in-app toasts for new pending circle invite requests.
  useEffect(() => {
    if (isDemo || !circleInvitesLoadedRef.current) return;

    const freshRequests = incomingCircleInvites.filter(
      (r) => { return r.status === 'pending' && !seenCircleInviteIdsRef.current.has(r.id); },
    );

    for (const req of freshRequests) {
      seenCircleInviteIdsRef.current.add(req.id);
      const inviter = allUsers.find((u) => { return u.id === req.inviterId; });
      const circle = channels.find((ch) => { return ch.id === req.channelId; });
      const firstName = inviter?.firstName ?? 'Someone';
      const channelName = circle?.name ?? 'your circle';
      addToast({
        type: 'info',
        title: `✨ ${firstName} invited you to join ${channelName}`,
        description: 'Tap to review the invite',
          onPress: () => router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: req.id } } as never),
      });
    }
  }, [isDemo, addToast, allUsers, channels, router, incomingCircleInvites]);

  // Effect 15: Clear the feed session-scroll flag when the app goes to the
  // background, so the next foreground (or cold launch) scrolls the feed to top.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        void AsyncStorage.removeItem(FEED_SESSION_SCROLLED_KEY);
      }
    });
    return () => { subscription.remove(); };
  }, []);

  // Effect 16: Foreground confirmation toast when one of the current user's
  // posts finishes uploading and transitions to ready.
  useEffect(() => {
    if (isDemo || !currentUser) {
      ownPostStatusRef.current = {};
      ownPostStatusInitializedRef.current = false;
      return;
    }

    const nextStatuses: Record<string, Post['status']> = {};
    posts.forEach((post) => {
      if (post.authorId !== currentUser.id) {
        return;
      }
      if (post.markedForDeletionAt !== null) {
        return;
      }
      nextStatuses[post.id] = post.status;
    });

    if (!ownPostStatusInitializedRef.current) {
      ownPostStatusRef.current = nextStatuses;
      ownPostStatusInitializedRef.current = true;
      return;
    }

    const appIsActive = AppState.currentState === 'active';
    if (appIsActive) {
      Object.entries(nextStatuses).forEach(([postId, nextStatus]) => {
        const prevStatus = ownPostStatusRef.current[postId];
        if (prevStatus === 'uploading' && nextStatus === 'ready') {
          addToast({
            type: 'success',
            title: 'Your post is live! 🎉',
            autoDismissMs: 2200,
          });
        }
      });
    }

    ownPostStatusRef.current = nextStatuses;
  }, [addToast, currentUser, isDemo, posts]);

  return <>{children}</>;
}
