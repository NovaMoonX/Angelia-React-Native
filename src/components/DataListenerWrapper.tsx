import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { setPosts } from '@/store/slices/postsSlice';
import { setChannels } from '@/store/slices/channelsSlice';
import { setCurrentUser, setUsers } from '@/store/slices/usersSlice';
import {
  setIncomingRequests,
  setOutgoingRequests,
} from '@/store/slices/invitesSlice';
import { processPendingInvite } from '@/store/actions/inviteActions';
import {
  subscribeToCurrentUser,
  subscribeToChannels,
  subscribeToPosts,
  subscribeToIncomingJoinRequests,
  subscribeToOutgoingJoinRequests,
  subscribeToChannelUsers,
} from '@/services/firebase/firestore';
import type { Channel, ChannelJoinRequest, Post, User } from '@/models/types';

interface DataListenerWrapperProps {
  children: React.ReactNode;
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
  const pendingInviteProcessed = useRef(false);

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
        addToast({ type: 'error', title: 'Failed to send join request' });
      });
  }, [pendingInviteChannel, currentUser, dispatch, addToast]);

  return <>{children}</>;
}
