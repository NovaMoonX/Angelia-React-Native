import { useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { setPosts } from '@/store/slices/postsSlice';
import {
  setChannels,
  setConnectionChannels,
  selectAllChannels,
  selectUserDailyChannel,
  syncDailyChannelMembers,
} from '@/store/slices/channelsSlice';
import {
  setCurrentUser,
  setUsers,
  setCurrentUserNotificationSettings,
} from '@/store/slices/usersSlice';
import { setUserInboxItems } from '@/store/slices/userInboxSlice';
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
import { processPendingInvite } from '@/store/actions/inviteActions';
import { processPendingConnection } from '@/store/actions/connectionsActions';
import {
  initNotifications,
  ensureCurrentDeviceTokenRegistered,
} from '@/store/actions/notificationActions';
import { setMobileAppConfig } from '@/store/slices/appConfigSlice';
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
  subscribeToUserInbox,
  subscribeToMobileAppConfig,
} from '@/services/firebase/firestore';
import { requestNotificationPermission } from '@/services/notifications';
import type {
  Channel,
  ChannelJoinRequest,
  Connection,
  ConnectionRequest,
  NotificationSettings,
  Post,
  User,
} from '@/models/types';

export function useDataListenerRealtimeData() {
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
  const posts = useAppSelector((state) => state.posts.items);

  const uid = firebaseUser?.uid ?? '';
  const myDailyChannelId = useAppSelector((state) => {
    return selectUserDailyChannel(state, uid)?.id ?? null;
  });

  const connectionsUserIdsKey = useMemo(() => {
    return connections
      .map((connection) => {
        return connection.userId;
      })
      .sort()
      .join(',');
  }, [connections]);

  const authUnsubsRef = useRef<Array<() => void>>([]);
  const postsUnsubRef = useRef<(() => void) | null>(null);
  const usersUnsubRef = useRef<(() => void) | null>(null);
  const notifSettingsUnsubRef = useRef<(() => void) | null>(null);
  const connectionChannelsUnsubRef = useRef<(() => void) | null>(null);
  const tasksUnsubRef = useRef<(() => void) | null>(null);
  const userInboxUnsubRef = useRef<(() => void) | null>(null);
  const pendingInviteProcessedRef = useRef(false);
  const pendingConnectionProcessedRef = useRef(false);
  const notifInitInFlightRef = useRef(false);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    const firebaseUid = firebaseUser.uid;

    const unsubUser = subscribeToCurrentUser(firebaseUid, (user: User | null) => {
      dispatch(setCurrentUser(user));
    });

    const unsubChannels = subscribeToChannels(firebaseUid, (nextChannels: Channel[]) => {
      dispatch(setChannels(nextChannels));
    });

    const unsubIncomingJoinRequests = subscribeToIncomingJoinRequests(
      firebaseUid,
      (reqs: ChannelJoinRequest[]) => {
        dispatch(setIncomingRequests(reqs));
      },
    );

    const unsubOutgoingJoinRequests = subscribeToOutgoingJoinRequests(
      firebaseUid,
      (reqs: ChannelJoinRequest[]) => {
        dispatch(setOutgoingRequests(reqs));
      },
    );

    const unsubIncomingCircleInvites = subscribeToIncomingCircleInviteRequests(firebaseUid, (reqs) => {
      dispatch(setIncomingCircleInvites(reqs));
    });

    const unsubOutgoingCircleInvites = subscribeToOutgoingCircleInviteRequests(firebaseUid, (reqs) => {
      dispatch(setOutgoingCircleInvites(reqs));
    });

    const unsubConnections = subscribeToConnections(firebaseUid, (nextConnections: Connection[]) => {
      dispatch(setConnections(nextConnections));
    });

    const unsubIncomingConnections = subscribeToIncomingConnectionRequests(
      firebaseUid,
      (reqs: ConnectionRequest[]) => {
        dispatch(setIncomingConnectionRequests(reqs));
      },
    );

    const unsubOutgoingConnections = subscribeToOutgoingConnectionRequests(
      firebaseUid,
      (reqs: ConnectionRequest[]) => {
        dispatch(setOutgoingConnectionRequests(reqs));
      },
    );

    authUnsubsRef.current = [
      unsubUser,
      unsubChannels,
      unsubIncomingJoinRequests,
      unsubOutgoingJoinRequests,
      unsubConnections,
      unsubIncomingConnections,
      unsubOutgoingConnections,
      unsubIncomingCircleInvites,
      unsubOutgoingCircleInvites,
    ];

    return () => {
      authUnsubsRef.current.forEach((unsub) => {
        unsub();
      });
      authUnsubsRef.current = [];
    };
  }, [dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    const firebaseUid = firebaseUser.uid;

    const connectionChannelIdSet = new Set(
      connectionChannels.map((channel) => {
        return channel.id;
      }),
    );

    const ownChannelIds = channels
      .filter((channel) => {
        return !connectionChannelIdSet.has(channel.id);
      })
      .map((channel) => {
        return channel.id;
      });

    const connectionDailyIds = connectionChannels.map((channel) => {
      return channel.id;
    });

    if (ownChannelIds.length === 0 && connectionDailyIds.length === 0) {
      return;
    }

    if (postsUnsubRef.current) {
      postsUnsubRef.current();
    }

    let ownPosts: Post[] = [];
    let connectionPosts: Post[] = [];

    const dispatchMergedPosts = () => {
      dispatch(setPosts([...ownPosts, ...connectionPosts]));
    };

    const unsubOwnPosts =
      ownChannelIds.length > 0
        ? subscribeToPosts(
            firebaseUid,
            ownChannelIds,
            (nextOwnPosts: Post[]) => {
              ownPosts = nextOwnPosts;
              dispatchMergedPosts();
            },
            () => {
              dispatchMergedPosts();
            },
          )
        : () => {};

    // Query connection daily channels SEPARATELY instead of batching them together.
    // This avoids a Firestore security rule evaluation issue where multiple different
    // channelIds in a single `in` query cause the isConnectedToAuthorDailyChannel()
    // rule to fail with permission-denied. Each single-channel query passes.
    const unsubConnectionPostsArray: Array<() => void> = [];
    const connectionPostsByChannelId = new Map<string, Post[]>();

    const updateConnectionPosts = () => {
      connectionPosts = Array.from(connectionPostsByChannelId.values()).flat();
      dispatchMergedPosts();
    };

    for (const channelId of connectionDailyIds) {
      const unsub = subscribeToPosts(
        firebaseUid,
        [channelId],
        (nextPosts: Post[]) => {
          connectionPostsByChannelId.set(channelId, nextPosts);
          updateConnectionPosts();
        },
        () => {
          connectionPostsByChannelId.set(channelId, []);
          updateConnectionPosts();
        },
      );
      unsubConnectionPostsArray.push(unsub);
    }

    postsUnsubRef.current = () => {
      unsubOwnPosts();
      unsubConnectionPostsArray.forEach((unsub) => unsub());
    };

    return () => {
      if (!postsUnsubRef.current) {
        return;
      }
      postsUnsubRef.current();
      postsUnsubRef.current = null;
    };
  }, [channels, connectionChannels, dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    const userIds = new Set<string>();

    channels.forEach((channel) => {
      userIds.add(channel.ownerId);
      channel.subscribers.forEach((subscriberId) => {
        userIds.add(subscriberId);
      });
    });

    connections.forEach((connection) => {
      userIds.add(connection.userId);
    });

    incomingConnectionRequests
      .filter((request) => {
        return request.status === 'pending';
      })
      .forEach((request) => {
        userIds.add(request.fromId);
      });

    const uniqueIds = Array.from(userIds);
    if (uniqueIds.length === 0) {
      return;
    }

    if (usersUnsubRef.current) {
      usersUnsubRef.current();
    }

    usersUnsubRef.current = subscribeToChannelUsers(uniqueIds, (users: User[]) => {
      dispatch(setUsers(users));
    });

    return () => {
      if (!usersUnsubRef.current) {
        return;
      }
      usersUnsubRef.current();
      usersUnsubRef.current = null;
    };
  }, [channels, connections, dispatch, firebaseUser, incomingConnectionRequests, isDemo]);

  useEffect(() => {
    if (!pendingInviteChannel || !currentUser || pendingInviteProcessedRef.current) {
      return;
    }

    pendingInviteProcessedRef.current = true;

    dispatch(processPendingInvite())
      .unwrap()
      .then((result) => {
        if (!result) {
          return;
        }
        addToast({ type: 'success', title: 'Join request sent!' });
      })
      .catch(() => {
        pendingInviteProcessedRef.current = false;
        addToast({ type: 'error', title: 'Failed to send join request' });
      });
  }, [addToast, currentUser, dispatch, pendingInviteChannel]);

  useEffect(() => {
    if (!pendingFromUserId || !currentUser || pendingConnectionProcessedRef.current) {
      return;
    }

    pendingConnectionProcessedRef.current = true;

    dispatch(processPendingConnection())
      .unwrap()
      .then((result) => {
        if (!result) {
          return;
        }

        const recipient = allUsers.find((user) => {
          return user.id === result.toId;
        });

        const toName = recipient ? ` to ${recipient.firstName}` : '';
        addToast({ type: 'success', title: `Connection request sent${toName}! 🤝` });
      })
      .catch(() => {
        pendingConnectionProcessedRef.current = false;
        addToast({ type: 'error', title: 'Failed to send connection request' });
      });
  }, [addToast, allUsers, currentUser, dispatch, pendingFromUserId]);

  useEffect(() => {
    if (isDemo || !firebaseUser || connections.length === 0) {
      if (connectionChannelsUnsubRef.current) {
        connectionChannelsUnsubRef.current();
        connectionChannelsUnsubRef.current = null;
      }
      dispatch(setConnectionChannels([]));
      return;
    }

    if (connectionChannelsUnsubRef.current) {
      connectionChannelsUnsubRef.current();
    }

    const connectedUserIds = connections.map((connection) => {
      return connection.userId;
    });

    connectionChannelsUnsubRef.current = subscribeToConnectionChannels(
      connectedUserIds,
      (nextConnectionChannels: Channel[]) => {
        dispatch(setConnectionChannels(nextConnectionChannels));
      },
      () => {},
    );

    return () => {
      if (!connectionChannelsUnsubRef.current) {
        return;
      }
      connectionChannelsUnsubRef.current();
      connectionChannelsUnsubRef.current = null;
    };
  }, [connections.length, connectionsUserIdsKey, dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser || !myDailyChannelId) {
      return;
    }

    const memberIds = connections.map((connection) => {
      return connection.userId;
    });

    dispatch(syncDailyChannelMembers({ channelId: myDailyChannelId, memberIds }));
  }, [connections, connectionsUserIdsKey, dispatch, firebaseUser, isDemo, myDailyChannelId]);

  useEffect(() => {
    if (isDemo || !firebaseUser || !currentUser) {
      return;
    }

    requestNotificationPermission().catch(() => {});

    notifInitInFlightRef.current = true;
    dispatch(initNotifications()).finally(() => {
      notifInitInFlightRef.current = false;
    });
  }, [currentUser, dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    const firebaseUid = firebaseUser.uid;

    if (notifSettingsUnsubRef.current) {
      notifSettingsUnsubRef.current();
    }

    notifSettingsUnsubRef.current = subscribeToNotificationSettings(
      firebaseUid,
      (settings: NotificationSettings | null) => {
        dispatch(setCurrentUserNotificationSettings(settings));

        if (settings) {
          // Keep the current device token entry self-healed after server-side
          // pruning of invalid tokens (NotRegistered).
          void dispatch(ensureCurrentDeviceTokenRegistered());
        }

        if (settings || notifInitInFlightRef.current) {
          return;
        }

        notifInitInFlightRef.current = true;
        dispatch(initNotifications()).finally(() => {
          notifInitInFlightRef.current = false;
        });
      },
    );

    return () => {
      if (!notifSettingsUnsubRef.current) {
        return;
      }
      notifSettingsUnsubRef.current();
      notifSettingsUnsubRef.current = null;
    };
  }, [dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser) {
      return;
    }

    tasksUnsubRef.current?.();
    tasksUnsubRef.current = subscribeToTasks(firebaseUser.uid, (tasks) => {
      dispatch(setTasks(tasks));
    });

    return () => {
      tasksUnsubRef.current?.();
      tasksUnsubRef.current = null;
    };
  }, [dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo || !firebaseUser || !currentUser) {
      userInboxUnsubRef.current?.();
      userInboxUnsubRef.current = null;
      dispatch(setUserInboxItems([]));
      return;
    }

    userInboxUnsubRef.current?.();
    userInboxUnsubRef.current = subscribeToUserInbox(currentUser.id, (items) => {
      dispatch(setUserInboxItems(items));
    });

    return () => {
      userInboxUnsubRef.current?.();
      userInboxUnsubRef.current = null;
    };
  }, [currentUser?.id, dispatch, firebaseUser, isDemo]);

  useEffect(() => {
    if (isDemo) {
      dispatch(setMobileAppConfig(null));
      return () => {};
    }

    const unsubscribe = subscribeToMobileAppConfig((config) => {
      dispatch(setMobileAppConfig(config));
    });

    return unsubscribe;
  }, [dispatch, isDemo]);
}
