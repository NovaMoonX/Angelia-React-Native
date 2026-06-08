import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAppSelector } from '@/store/hooks';
import { selectAllChannels } from '@/store/slices/channelsSlice';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  NOTIFICATION_ID,
  WIND_DOWN_NOTIFICATION_ID,
  getFollowUpForPrompt,
  dismissNotificationsByData,
} from '@/services/notifications';
import type { AppNotificationType, Post } from '@/models/types';
import { consumeNotificationResponse } from '@/lib/notificationResponseDedup';

const DAILY_PROMPT_SHOWN_DATE_KEY = '@angelia/daily_prompt_shown_date';
const STARTUP_TOAST_SUPPRESSION_MS = 5000;

const handledForegroundToastKeys = new Set<string>();

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue === 'string') {
      out[key] = entryValue;
      continue;
    }
    if (typeof entryValue === 'number' || typeof entryValue === 'boolean') {
      out[key] = String(entryValue);
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function extractNotificationData(notification: Notifications.Notification): Record<string, string> | undefined {
  const contentData = toStringRecord(notification.request.content.data);
  if (contentData && Object.keys(contentData).length > 0) {
    return contentData;
  }

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

function isDailyPromptNotification(identifier: string) {
  return identifier === NOTIFICATION_ID || identifier === WIND_DOWN_NOTIFICATION_ID;
}

export function useDataListenerNotifications() {
  const { firebaseUser } = useAuth();
  const { addToast } = useToast();

  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const allUsers = useAppSelector((state) => state.users.users);
  const channels = useAppSelector(selectAllChannels);
  const posts = useAppSelector((state) => state.posts.items);
  const incomingConnectionRequests = useAppSelector((state) => state.connections.incomingRequests);
  const incomingJoinRequests = useAppSelector((state) => state.invites.incoming);
  const incomingCircleInvites = useAppSelector((state) => state.invites.incomingCircleInvites);

  const currentUserRef = useRef(currentUser);
  const postsRef = useRef(posts);
  const seenConnectionRequestIdsRef = useRef(new Set<string>());
  const connectionRequestsLoadedRef = useRef(false);
  const seenJoinRequestIdsRef = useRef(new Set<string>());
  const joinRequestsLoadedRef = useRef(false);
  const seenCircleInviteIdsRef = useRef(new Set<string>());
  const circleInvitesLoadedRef = useRef(false);
  const ownPostStatusRef = useRef<Record<string, Post['status']>>({});
  const ownPostStatusInitializedRef = useRef(false);
  const foregroundToastsEnabledAtRef = useRef(Number.MAX_SAFE_INTEGER);

  const routeFromNotificationPayloadRef = useRef(
    (type: string | undefined, data: Record<string, string> | undefined) => {
      if (type === 'join_channel_request') {
        const joinRequestId = data?.joinRequestId;
        if (joinRequestId) {
          router.push({ pathname: '/(protected)/join-request/[id]', params: { id: joinRequestId } });
        } else {
          router.push('/(protected)/notifications');
        }
        return;
      }

      if (type === 'join_channel_accepted') {
        const channelName = data?.channelName ?? '';
        router.push({ pathname: '/(protected)/channel-accepted', params: { channelName } });
        return;
      }

      if (type === 'custom_circle_invite') {
        const requestId = data?.requestId;
        if (requestId) {
          router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: requestId } } as never);
        } else {
          router.push('/(protected)/notifications');
        }
        return;
      }

      if (type === 'connection_request') {
        const requestId = data?.connectionRequestId;
        if (requestId) {
          router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: requestId } });
        } else {
          router.push('/(protected)/notifications');
        }
        return;
      }

      if (type === 'connection_accepted') {
        router.push('/(protected)/my-people');
        return;
      }

      if (type === 'new_post' || type === 'post_reaction') {
        const postId = data?.postId;
        if (postId) {
          if (type === 'post_reaction') {
            void dismissNotificationsByData({ type: 'post_reaction', postId });
          } else {
            void dismissNotificationsByData({ type: 'new_post', postId });
          }
          router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } });
        }
        return;
      }

      if (type === 'conversation_message' || type === 'comment_reply') {
        const postId = data?.postId;
        if (postId) {
          void dismissNotificationsByData({ type, postId });
          router.push({ pathname: '/(protected)/conversation', params: { postId } });
        }
        return;
      }

      if (type === 'private_note') {
        const postId = data?.postId;
        if (postId) {
          void dismissNotificationsByData({ type: 'private_note', postId });
          router.push({ pathname: '/(protected)/private-notes-host/[postId]', params: { postId } });
        }
        return;
      }

      if (type === 'private_note_reply') {
        const postId = data?.postId;
        const noteId = data?.noteId;
        if (postId && noteId) {
          void dismissNotificationsByData({ type: 'private_note_reply', postId, noteId });
          router.push({
            pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
            params: { postId, noteId },
          });
        }
        return;
      }


    },
  );

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    seenConnectionRequestIdsRef.current = new Set();
    connectionRequestsLoadedRef.current = false;
    seenJoinRequestIdsRef.current = new Set();
    joinRequestsLoadedRef.current = false;
    seenCircleInviteIdsRef.current = new Set();
    circleInvitesLoadedRef.current = false;
    handledForegroundToastKeys.clear();
    foregroundToastsEnabledAtRef.current = Date.now() + STARTUP_TOAST_SUPPRESSION_MS;
  }, [firebaseUser?.uid, isDemo]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void (async () => {
        const notification = response.notification;
        if (notification.request.identifier !== NOTIFICATION_ID) {
          return;
        }

        const shouldRoute = await consumeNotificationResponse(response);
        if (!shouldRoute) {
          return;
        }

        const promptIndex = Number((notification.request.content.data?.promptIndex as string) ?? '0');
        const followUp = getFollowUpForPrompt(promptIndex);
        router.push({ pathname: '/(protected)/post/new', params: { notificationPrompt: followUp } });
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [isDemo]);

  useEffect(() => {
    if (isDemo || !currentUser) {
      return;
    }

    Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (!response) {
          return;
        }

        const shouldRoute = await consumeNotificationResponse(response);
        if (!shouldRoute) {
          return;
        }

        const notification = response.notification;
        const identifier = notification.request.identifier;
        const data = extractNotificationData(notification);
        const type = data?.type;

        if (identifier === NOTIFICATION_ID) {
          const promptIndex = Number(data?.promptIndex ?? '0');
          const followUp = getFollowUpForPrompt(promptIndex);
          router.push({ pathname: '/(protected)/post/new', params: { notificationPrompt: followUp } });
          return;
        }

        routeFromNotificationPayloadRef.current(type, data);
      })
      .catch(() => {});
  }, [currentUser?.id, isDemo]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const identifier = notification.request.identifier;

      if (isDailyPromptNotification(identifier)) {
        const user = currentUserRef.current;
        if (!user) {
          return;
        }

        const today = new Date().toDateString();
        const hasPostedToday = postsRef.current.some((post) => {
          return post.authorId === user.id && new Date(post.timestamp).toDateString() === today;
        });

        if (hasPostedToday) {
          return;
        }

        void (async () => {
          try {
            const shownDate = await AsyncStorage.getItem(DAILY_PROMPT_SHOWN_DATE_KEY);
            if (shownDate === today) {
              return;
            }

            await AsyncStorage.setItem(DAILY_PROMPT_SHOWN_DATE_KEY, today);

            const body = notification.request.content.body ?? "What's going on today? ✨";
            addToast({
              type: 'info',
              title: '✨ Time to share!',
              description: body,
              onPress: () => {
                router.push({
                  pathname: '/(protected)/post/new',
                  params: { notificationPrompt: getFollowUpForPrompt(0) },
                });
              },
            });
          } catch {
            return;
          }
        })();

        return;
      }

      const toastKey = getForegroundToastKey(notification);
      if (handledForegroundToastKeys.has(toastKey)) {
        return;
      }
      handledForegroundToastKeys.add(toastKey);

      if (Date.now() < foregroundToastsEnabledAtRef.current) {
        return;
      }

      const data = extractNotificationData(notification);
      const type = data?.type as AppNotificationType | undefined;

      if (type === 'join_channel_request') {
        const channelName = data?.channelName ?? 'your circle';
        const firstName = data?.requesterFirstName ?? 'Someone';
        const joinRequestId = data?.joinRequestId;
        if (joinRequestId) {
          seenJoinRequestIdsRef.current.add(joinRequestId);
        }

        addToast({
          type: 'info',
          title: `📬 ${firstName} wants to join!`,
          description: `Tap to review their request for ${channelName}`,
          onPress: joinRequestId
            ? () => {
                router.push({ pathname: '/(protected)/join-request/[id]', params: { id: joinRequestId } });
              }
            : undefined,
        });
        return;
      }

      if (type === 'join_channel_accepted') {
        const channelName = data?.channelName ?? 'the circle';
        addToast({
          type: 'success',
          title: "🎉 You're in!",
          description: `Tap to check out ${channelName}`,
          onPress: () => {
            router.push({ pathname: '/(protected)/channel-accepted', params: { channelName } });
          },
        });
        return;
      }

      if (type === 'custom_circle_invite') {
        const channelName = data?.channelName ?? 'this circle';
        const firstName = data?.inviterFirstName ?? 'Someone';
        const inviteCode = data?.inviteCode;
        const requestId = data?.requestId;

        if (requestId) {
          seenCircleInviteIdsRef.current.add(requestId);
        }

        addToast({
          type: 'info',
          title: `✨ ${firstName} invited you to join ${channelName}`,
          description: inviteCode ? 'Tap to review the invite' : 'Open notifications to view details',
          onPress: requestId
            ? () => {
                router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: requestId } } as never);
              }
            : () => {
                router.push('/(protected)/notifications');
              },
        });
        return;
      }

      if (type === 'connection_request') {
        const firstName = data?.fromFirstName ?? 'Someone';
        const requestId = data?.connectionRequestId;

        if (requestId) {
          seenConnectionRequestIdsRef.current.add(requestId);
        }

        addToast({
          type: 'info',
          title: `🤝 ${firstName} wants to connect!`,
          description: 'Tap to review their connection request',
          onPress: requestId
            ? () => {
                router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: requestId } });
              }
            : () => {
                router.push('/(protected)/notifications');
              },
        });
        return;
      }

      if (type === 'connection_accepted') {
        const firstName = data?.toFirstName ?? 'Someone';
        addToast({
          type: 'success',
          title: `🎉 You're connected with ${firstName}!`,
          description: 'Tap to see your people',
          onPress: () => {
            router.push('/(protected)/my-people');
          },
        });
        return;
      }

      if (type === 'new_post') {
        const firstName = data?.authorFirstName ?? 'Someone';
        const lastName = data?.authorLastName ?? '';
        const fullName = lastName ? `${firstName} ${lastName}` : firstName;
        const postId = data?.postId;
        const isDaily = data?.isDaily === 'true';
        const channelName = data?.channelName ?? '';
        const tier = data?.tier ?? 'everyday';
        const hasAttachments = data?.hasAttachments === 'true';

        const toastTitle =
          tier === 'big-news'
            ? `🚨 Big News from ${fullName}`
            : tier === 'worth-knowing'
              ? `💡 Worth Knowing from ${fullName}`
              : `📝 ${fullName} shared a new post`;

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
            ? () => {
                router.push({ pathname: '/(protected)/post/[id]', params: { id: postId } });
              }
            : undefined,
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [addToast, isDemo]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!connectionRequestsLoadedRef.current) {
      incomingConnectionRequests.forEach((request) => {
        if (request.status === 'pending') {
          seenConnectionRequestIdsRef.current.add(request.id);
        }
      });
      connectionRequestsLoadedRef.current = true;
      return;
    }

    const freshRequests = incomingConnectionRequests.filter((request) => {
      return request.status === 'pending' && !seenConnectionRequestIdsRef.current.has(request.id);
    });

    const suppressDuringStartup = Date.now() < foregroundToastsEnabledAtRef.current;

    freshRequests.forEach((request) => {
      seenConnectionRequestIdsRef.current.add(request.id);
      if (suppressDuringStartup) {
        return;
      }
      const sender = allUsers.find((user) => {
        return user.id === request.fromId;
      });

      const firstName = sender?.firstName ?? 'Someone';
      addToast({
        type: 'info',
        title: `🤝 ${firstName} wants to connect!`,
        description: 'Tap to review their connection request',
        onPress: () => {
          router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: request.id } });
        },
      });
    });
  }, [addToast, allUsers, incomingConnectionRequests, isDemo]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!joinRequestsLoadedRef.current) {
      incomingJoinRequests.forEach((request) => {
        if (request.status === 'pending') {
          seenJoinRequestIdsRef.current.add(request.id);
        }
      });
      joinRequestsLoadedRef.current = true;
      return;
    }

    const freshRequests = incomingJoinRequests.filter((request) => {
      return request.status === 'pending' && !seenJoinRequestIdsRef.current.has(request.id);
    });

    const suppressDuringStartup = Date.now() < foregroundToastsEnabledAtRef.current;

    freshRequests.forEach((request) => {
      seenJoinRequestIdsRef.current.add(request.id);
      if (suppressDuringStartup) {
        return;
      }
      const requester = allUsers.find((user) => {
        return user.id === request.requesterId;
      });
      const circle = channels.find((channel) => {
        return channel.id === request.channelId;
      });

      const firstName = requester?.firstName ?? 'Someone';
      const channelName = circle?.name ?? 'your circle';
      addToast({
        type: 'info',
        title: `📬 ${firstName} wants to join!`,
        description: `Tap to review their request for ${channelName}`,
        onPress: () => {
          router.push({ pathname: '/(protected)/join-request/[id]', params: { id: request.id } });
        },
      });
    });
  }, [addToast, allUsers, channels, incomingJoinRequests, isDemo]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!circleInvitesLoadedRef.current) {
      incomingCircleInvites.forEach((invite) => {
        if (invite.status === 'pending') {
          seenCircleInviteIdsRef.current.add(invite.id);
        }
      });
      circleInvitesLoadedRef.current = true;
      return;
    }

    const freshInvites = incomingCircleInvites.filter((invite) => {
      return invite.status === 'pending' && !seenCircleInviteIdsRef.current.has(invite.id);
    });

    const suppressDuringStartup = Date.now() < foregroundToastsEnabledAtRef.current;

    freshInvites.forEach((invite) => {
      seenCircleInviteIdsRef.current.add(invite.id);
      if (suppressDuringStartup) {
        return;
      }
      const inviter = allUsers.find((user) => {
        return user.id === invite.inviterId;
      });
      const circle = channels.find((channel) => {
        return channel.id === invite.channelId;
      });

      const firstName = inviter?.firstName ?? 'Someone';
      const channelName = circle?.name ?? 'your circle';
      addToast({
        type: 'info',
        title: `✨ ${firstName} invited you to join ${channelName}`,
        description: 'Tap to review the invite',
        onPress: () => {
          router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: invite.id } } as never);
        },
      });
    });
  }, [addToast, allUsers, channels, incomingCircleInvites, isDemo]);

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
}
