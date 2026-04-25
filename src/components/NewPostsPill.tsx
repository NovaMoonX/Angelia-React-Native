import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { useTheme } from '@/hooks/useTheme';
import { FEED_LAST_SEEN_TIMESTAMP_KEY } from '@/models/constants';
import type { Post, User } from '@/models/types';

export interface NewPostsPillRef {
  /**
   * Call this from the parent's onScroll handler so the pill can auto-dismiss
   * when the feed scrolls back to the top without the parent needing to know
   * anything about the pill's internal state.
   */
  notifyScrollY: (y: number) => void;
}

interface NewPostsPillProps {
  /** Vertical distance from the top of the screen where the pill should appear (headerHeight + gap). */
  topOffset: number;
  /** Called when the user taps the pill so the parent can scroll the list to the top. */
  onRequestScrollToTop: () => void;
}

/**
 * Floating pill that surfaces below the feed header when new posts from other
 * users arrive while the user is in-app.  The component is always rendered
 * and owns all logic for determining its own visibility.
 *
 * – Up to 3 overlapping author avatars + post count label
 * – Tapping scrolls to the top and marks the new posts as seen
 * – Auto-dismisses when the user naturally scrolls to the top
 * – Last-seen timestamp is persisted in AsyncStorage (device-only, not cloud)
 */
export const NewPostsPill = forwardRef<NewPostsPillRef, NewPostsPillProps>(
  function NewPostsPill({ topOffset, onRequestScrollToTop }, ref) {
    const { theme } = useTheme();

    const posts = useAppSelector((state) => state.posts.items);
    const postsLoaded = useAppSelector((state) => state.posts.loaded);
    const currentUser = useAppSelector((state) => state.users.currentUser);
    const usersMap = useAppSelector(selectAllUsersMapById);

    // Ref to the highest timestamp the user has acknowledged — mutated in place
    // so it never triggers re-renders.
    const lastSeenTimestampRef = useRef<number>(0);
    const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

    const [newPosts, setNewPosts] = useState<Post[]>([]);
    // Ref mirror of newPosts.length so notifyScrollY (in useImperativeHandle)
    // can read it without being included in the imperative handle's deps.
    const hasNewPostsRef = useRef(false);

    const pillAnimValue = useRef(new Animated.Value(0)).current;
    const pillAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    // Stable ref to markPostsSeen so notifyScrollY and handleTap never need to
    // be recreated when the posts list changes.
    const markPostsSeenRef = useRef<() => void>(() => {});

    // ── Imperative handle ───────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      notifyScrollY(y: number) {
        if (y <= 50 && hasNewPostsRef.current) {
          markPostsSeenRef.current();
        }
      },
    }));

    // ── Helpers ─────────────────────────────────────────────────────────────

    const markPostsSeen = useCallback(() => {
      const readyPosts = posts.filter((p) => p.status === 'ready');
      const maxTs =
        readyPosts.length > 0
          ? Math.max(...readyPosts.map((p) => p.timestamp))
          : Date.now();
      lastSeenTimestampRef.current = maxTs;
      void AsyncStorage.setItem(FEED_LAST_SEEN_TIMESTAMP_KEY, String(maxTs));
      setNewPosts([]);
    }, [posts]);

    useEffect(() => {
      markPostsSeenRef.current = markPostsSeen;
    }, [markPostsSeen]);

    useEffect(() => {
      hasNewPostsRef.current = newPosts.length > 0;
    }, [newPosts]);

    // ── AsyncStorage bootstrap ───────────────────────────────────────────────

    useEffect(() => {
      AsyncStorage.getItem(FEED_LAST_SEEN_TIMESTAMP_KEY)
        .then((val) => {
          lastSeenTimestampRef.current = val ? parseInt(val, 10) : 0;
        })
        .catch(() => {
          // Fall back to 0 (first-visit behaviour) if storage is unavailable.
          lastSeenTimestampRef.current = 0;
        })
        .finally(() => {
          setLastSeenLoaded(true);
        });
    }, []);

    // ── New-posts computation ────────────────────────────────────────────────

    // lastSeenTimestampRef is intentionally omitted from deps — it is a stable
    // ref whose .current is mutated in-place; adding it would create a
    // phantom dependency without affecting correctness.
    useEffect(() => {
      if (!lastSeenLoaded || !postsLoaded || !currentUser) return;

      if (lastSeenTimestampRef.current === 0) {
        // First visit ever — treat every existing post as already seen so we
        // don't overwhelm the user with a pill on first open.
        const readyPosts = posts.filter((p) => p.status === 'ready');
        if (readyPosts.length > 0) {
          const maxTs = Math.max(...readyPosts.map((p) => p.timestamp));
          lastSeenTimestampRef.current = maxTs;
          void AsyncStorage.setItem(FEED_LAST_SEEN_TIMESTAMP_KEY, String(maxTs));
        }
        setNewPosts([]);
        return;
      }

      const threshold = lastSeenTimestampRef.current;
      const incoming = posts.filter(
        (p) =>
          p.status === 'ready' &&
          p.authorId !== currentUser.id &&
          p.timestamp > threshold,
      );
      setNewPosts(incoming);
    }, [posts, postsLoaded, currentUser, lastSeenLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Animation ───────────────────────────────────────────────────────────

    // pillAnimValue is created from useRef().current and is stable for the
    // component lifetime — it intentionally stays out of the deps array.
    useEffect(() => {
      pillAnimRef.current?.stop();
      pillAnimRef.current = Animated.timing(pillAnimValue, {
        toValue: newPosts.length > 0 ? 1 : 0,
        duration: newPosts.length > 0 ? 300 : 200,
        useNativeDriver: true,
      });
      pillAnimRef.current.start();
    }, [newPosts.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived data ─────────────────────────────────────────────────────────

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
      markPostsSeenRef.current();
      onRequestScrollToTop();
    }, [onRequestScrollToTop]);

    // ── Render ───────────────────────────────────────────────────────────────

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
            {newPosts.length} new {newPosts.length === 1 ? 'post' : 'posts'}
          </Text>
          <Feather name="arrow-up" size={13} color={theme.background} />
        </Pressable>
      </Animated.View>
    );
  },
);

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
