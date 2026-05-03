import { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { completeTask } from '@/store/actions/taskActions';
import { selectAllChannels } from '@/store/slices/channelsSlice';

/**
 * Runs once when posts and tasks are both loaded from Firestore.
 * For each pending task, checks if its completion condition is already met
 * and auto-completes it. Re-runs only if a prior write failed and the task
 * was rolled back into Redux (retry path).
 *
 * Returns true while auto-completion is in progress so the feed banner can
 * be suppressed during the brief window before tasks are removed.
 */
export function useAutoCompleteTasks(): boolean {
  const dispatch = useAppDispatch();
  const posts = useAppSelector((state) => state.posts.items);
  const postsLoaded = useAppSelector((state) => state.posts.loaded);
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const pendingTasks = useAppSelector((state) => state.tasks.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channels = useAppSelector(selectAllChannels);

  const [isAutoCompleting, setIsAutoCompleting] = useState(false);

  // IDs dispatched this session. Used to detect rollbacks (write failed → task
  // reappears in pendingTasks) so we can retry.
  const dispatchedIds = useRef<Set<string>>(new Set());

  // Whether the initial check has already run. After that, we only re-run on retry.
  const hasRanInitialCheck = useRef(false);

  useEffect(() => {
    if (!postsLoaded || !tasksLoaded || !currentUser) {
      setIsAutoCompleting(false);
      return;
    }

    if (pendingTasks.length === 0) {
      setIsAutoCompleting(false);
      return;
    }

    // After the initial pass, only proceed if a previously-dispatched task
    // reappeared (its write failed and was rolled back — needs a retry).
    const needsRetry = pendingTasks.some((t) => { return dispatchedIds.current.has(t.id); });
    if (hasRanInitialCheck.current && !needsRetry) {
      return;
    }

    hasRanInitialCheck.current = true;
    setIsAutoCompleting(true);

    const currentUserId = currentUser.id;
    const userPosts = posts.filter((p) => { return p.authorId === currentUserId; });
    const ownedCustomChannels = channels.filter(
      (ch) => { return ch.ownerId === currentUserId && !ch.isDaily; },
    );

    const tasksToComplete: string[] = [];

    pendingTasks.forEach((task) => {
      // Task reappeared after a failed write — clear so it can be retried.
      if (dispatchedIds.current.has(task.id)) {
        dispatchedIds.current.delete(task.id);
      }

      let completed = false;

      switch (task.type) {
        case 'make_first_post':
          completed = userPosts.length > 0;
          break;

        case 'set_status':
          completed = currentUser.status !== null;
          break;

        case 'set_fun_fact':
          completed = Boolean(currentUser.funFact && currentUser.funFact.trim().length > 0);
          break;

        case 'create_custom_circle':
          completed = currentUser.customChannelCount > 0;
          break;

        case 'invite_to_circle':
          if (task.channelId) {
            completed = ownedCustomChannels.some((ch) => {
              return ch.id === task.channelId && ch.subscribers.length > 0;
            });
          }
          break;

        default:
          break;
      }

      if (completed) {
        tasksToComplete.push(task.id);
      }
    });

    tasksToComplete.forEach((id) => {
      dispatchedIds.current.add(id);
      dispatch(completeTask(id));
    });

    setIsAutoCompleting(false);
  }, [postsLoaded, tasksLoaded, posts, pendingTasks, currentUser, channels, dispatch]);

  return isAutoCompleting;
}
