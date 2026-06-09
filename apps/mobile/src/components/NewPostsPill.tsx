import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { FEED_LAST_SEEN_TIMESTAMP_KEY } from '@/models/constants';
import type { Post, User } from '@/models/types';

interface NewPostsScrollTarget {
  direction: 'up' | 'down';
  index: number;
}

interface NewPostsPillProps {
  /** Vertical distance from the top of the screen where the pill should appear (headerHeight + gap). */
  topOffset: number;
  /** Ordered post ids currently shown in the feed list. */
  orderedPostIds: string[];
  /** Post ids that are currently visible in the feed viewport. */
  visiblePostIds: string[];
  /** Called when the user taps the pill so the parent can scroll to the target index. */
  onRequestScrollToIndex: (index: number) => void;
}

function areAllNewPostsVisible(newPosts: Post[], visiblePostIds: string[]): boolean {
  if (newPosts.length === 0 || visiblePostIds.length === 0) {
    return false;
  }
  const visibleIdSet = new Set(visiblePostIds);
  return newPosts.every((post) => visibleIdSet.has(post.id));
}

function getScrollTarget(
  newPosts: Post[],
  orderedPostIds: string[],
  visiblePostIds: string[],
): NewPostsScrollTarget | null {
  if (newPosts.length === 0 || orderedPostIds.length === 0) {
    return null;
  }

  const newIdSet = new Set(newPosts.map((post) => post.id));
  const newIndices = orderedPostIds
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => newIdSet.has(id));

  const visibleIndices = orderedPostIds
    .map((id, index) => (visiblePostIds.includes(id) ? index : -1))
    .filter((index) => index >= 0);

  if (visibleIndices.length === 0) {
    return { direction: 'up', index: newIndices[0]?.index ?? 0 };
  }

  const minVisible = Math.min(...visibleIndices);
  const maxVisible = Math.max(...visibleIndices);
  const above = newIndices.filter(({ index }) => index < minVisible);
  const below = newIndices.filter(({ index }) => index > maxVisible);

  if (above.length === 0 && below.length === 0) {
    return null;
  }

  if (above.length > 0 && below.length === 0) {
    return { direction: 'up', index: above[0].index };
  }

  if (below.length > 0 && above.length === 0) {
    return { direction: 'down', index: below[0].index };
  }

  const center = (minVisible + maxVisible) / 2;
  const nearestAbove = above[above.length - 1];
  const nearestBelow = below[0];
  const distanceAbove = center - nearestAbove.index;
  const distanceBelow = nearestBelow.index - center;

  if (distanceAbove <= distanceBelow) {
    return { direction: 'up', index: nearestAbove.index };
  }

  return { direction: 'down', index: nearestBelow.index };
}

/**
 * Floating pill that surfaces below the feed header when new posts from other
 * users arrive while the user is in-app. The component owns its visibility and
 * points toward unseen posts above or below the current viewport.
 */
export function NewPostsPill({ topOffset, orderedPostIds, visiblePostIds, onRequestScrollToIndex }: NewPostsPillProps) {
    const { theme } = useTheme();

    const posts = useAppSelector((state) => state.posts.items);
    const postsLoaded = useAppSelector((state) => state.posts.loaded);
    const currentUser = useAppSelector((state) => state.users.currentUser);
    const usersMap = useAppSelector(selectAllUsersMapById);

    const lastSeenTimestampRef = useRef<number>(0);
    const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

    const [newPosts, setNewPosts] = useState<Post[]>([]);
    const [displayedNewPostCount, setDisplayedNewPostCount] = useState(0);
    const isFocusedRef = useRef(false);

    useFocusEffect(
      useCallback(() => {
        isFocusedRef.current = true;
        return () => {
          isFocusedRef.current = false;
        };
      }, []),
    );

    const pillAnimValue = useRef(new Animated.Value(0)).current;
    const pillAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    const markPostsSeenRef = useRef<() => void>(() => {});

    const markPostsSeen = useCallback(() => {
      const readyPosts = posts.filter((post) => post.status === 'ready');
      const maxTs =
        readyPosts.length > 0
          ? Math.max(...readyPosts.map((post) => post.timestamp))
          : Date.now();
      lastSeenTimestampRef.current = maxTs;
      void AsyncStorage.setItem(FEED_LAST_SEEN_TIMESTAMP_KEY, String(maxTs));
      setNewPosts([]);
    }, [posts]);

    useEffect(() => {
      markPostsSeenRef.current = markPostsSeen;
    }, [markPostsSeen]);

    useEffect(() => {
      if (newPosts.length > 0) {
        setDisplayedNewPostCount(newPosts.length);
      }
    }, [newPosts.length]);

    useEffect(() => {
      AsyncStorage.getItem(FEED_LAST_SEEN_TIMESTAMP_KEY)
        .then((val) => {
          lastSeenTimestampRef.current = val ? Number(val) : 0;
        })
        .catch(() => {
          lastSeenTimestampRef.current = 0;
        })
        .finally(() => {
          setLastSeenLoaded(true);
        });
    }, []);

    const scrollTarget = useMemo(() => {
      return getScrollTarget(newPosts, orderedPostIds, visiblePostIds);
    }, [newPosts, orderedPostIds, visiblePostIds]);

    useEffect(() => {
      if (!lastSeenLoaded || !postsLoaded || !currentUser) return;

      if (lastSeenTimestampRef.current === 0) {
        const readyPosts = posts.filter((post) => post.status === 'ready');
        if (readyPosts.length > 0) {
          const maxTs = Math.max(...readyPosts.map((post) => post.timestamp));
          lastSeenTimestampRef.current = maxTs;
          void AsyncStorage.setItem(FEED_LAST_SEEN_TIMESTAMP_KEY, String(maxTs));
        }
        setNewPosts([]);
        return;
      }

      const threshold = lastSeenTimestampRef.current;
      const incoming = posts.filter(
        (post) =>
          post.status === 'ready' &&
          post.authorId !== currentUser.id &&
          post.timestamp > threshold,
      );

      if (
        incoming.length > 0 &&
        newPosts.length === 0 &&
        isFocusedRef.current &&
        areAllNewPostsVisible(incoming, visiblePostIds)
      ) {
        markPostsSeenRef.current();
        return;
      }

      setNewPosts(incoming);
    }, [posts, postsLoaded, currentUser, lastSeenLoaded, newPosts.length, visiblePostIds]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (newPosts.length === 0 || visiblePostIds.length === 0) {
        return;
      }
      if (areAllNewPostsVisible(newPosts, visiblePostIds)) {
        markPostsSeenRef.current();
      }
    }, [newPosts, visiblePostIds]);

    useEffect(() => {
      pillAnimRef.current?.stop();
      pillAnimRef.current = Animated.timing(pillAnimValue, {
        toValue: newPosts.length > 0 ? 1 : 0,
        duration: newPosts.length > 0 ? 300 : 200,
        useNativeDriver: true,
      });
      pillAnimRef.current.start();
    }, [newPosts.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const pillAuthors = useMemo<User[]>(() => {
      const seen = new Set<string>();
      const result: User[] = [];
      for (const post of newPosts) {
        if (!seen.has(post.authorId)) {
          seen.add(post.authorId);
          const user = usersMap[post.authorId];
          if (user) result.push(user);
        }
        if (result.length >= 3) break;
      }
      return result;
    }, [newPosts, usersMap]);

    const handleTap = useCallback(() => {
      if (scrollTarget) {
        onRequestScrollToIndex(scrollTarget.index);
        return;
      }
      markPostsSeenRef.current();
    }, [onRequestScrollToIndex, scrollTarget]);

    const arrowName = scrollTarget?.direction === 'down' ? 'arrow-down' : 'arrow-up';

    return (
      <Animated.View
        style={[
          styles.container,
          {
            top: topOffset,
            opacity: pillAnimValue,
            transform: [
              {
                translateY: pillAnimValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={newPosts.length > 0 ? 'box-none' : 'none'}
      >
        <Pressable
          onPress={handleTap}
          style={[styles.pill, { backgroundColor: theme.foreground }]}
        >
          {pillAuthors.length > 0 && (
            <View style={styles.avatars}>
              {pillAuthors.map((author, idx) => (
                <View
                  key={author.id}
                  style={[
                    styles.avatarWrapper,
                    {
                      borderColor: theme.foreground,
                      marginLeft: idx === 0 ? 0 : -8,
                    },
                  ]}
                >
                  <Avatar user={author} size="sm" />
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.text, { color: theme.background }]}>
            {displayedNewPostCount} new {displayedNewPostCount === 1 ? 'post' : 'posts'}
          </Text>
          <Feather name={arrowName} size={13} color={theme.background} />
        </Pressable>
      </Animated.View>
    );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 11,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 100,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});
