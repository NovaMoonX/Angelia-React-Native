import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { completeTask } from '@/store/actions/taskActions';
import { selectAllChannels } from '@/store/slices/channelsSlice';

/**
 * Runs once when posts and tasks are both loaded.
 * For each pending task, checks if the completion condition is already met
 * (e.g. the user already made a post, set a status, etc.) and auto-completes it.
 *
 * Conditions per task type:
 * - `make_first_post`:    user has at least one ready post
 * - `set_status`:         user's status field is non-null (set at some point, even if now expired)
 * - `set_fun_fact`:       user has a non-empty funFact
 * - `create_custom_circle`: user's customChannelCount > 0
 * - `invite_to_circle`:   at least one custom channel owned by the user has ≥1 subscriber
 */
export function useAutoCompleteTasks(): void {
  const dispatch = useAppDispatch();
  const posts = useAppSelector((state) => state.posts.items);
  const postsLoaded = useAppSelector((state) => state.posts.loaded);
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const pendingTasks = useAppSelector((state) => state.tasks.items);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const channels = useAppSelector(selectAllChannels);

  useEffect(() => {
    if (!postsLoaded || !tasksLoaded || pendingTasks.length === 0 || !currentUser) return;

    const currentUserId = currentUser.id;
    const readyPosts = posts.filter((p) => { return p.status === 'ready'; });
    const ownedCustomChannels = channels.filter(
      (ch) => { return ch.ownerId === currentUserId && !ch.isDaily; },
    );

    pendingTasks.forEach((task) => {
      let completed = false;

      switch (task.type) {
        case 'make_first_post':
          completed = readyPosts.some((p) => { return p.authorId === currentUserId; });
          break;

        case 'set_status':
          // Status field is non-null if the user has ever set a status
          completed = currentUser.status !== null;
          break;

        case 'set_fun_fact':
          completed = Boolean(currentUser.funFact && currentUser.funFact.trim().length > 0);
          break;

        case 'create_custom_circle':
          completed = currentUser.customChannelCount > 0;
          break;

        case 'invite_to_circle':
          // A circle-specific invite task: only complete if the targeted channel has members.
          // If channelId is missing (shouldn't happen in normal flow), skip auto-completion.
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
        dispatch(completeTask(task.id));
      }
    });
  }, [postsLoaded, tasksLoaded, posts, pendingTasks, currentUser, channels, dispatch]);
}
