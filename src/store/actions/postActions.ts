import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Post, Reaction, Comment, MediaItem, PostTier, BigNewsPostNotification } from '@/models/types';
import type { MediaFile } from '@/components/PostCreateMediaUploader';
import {
  createPost,
  updatePost,
  joinConversation as firestoreJoinConversation,
  addReactionToPost,
  removeReactionFromPost,
  addComment,
  createAppNotification,
} from '@/services/firebase/firestore';
import { uploadPostMedia } from '@/services/firebase/storage';
import { generateId } from '@/utils/generateId';
import {
  addPost,
  updateReactionsOptimistic,
  removeReactionOptimistic,
  revertReactionsOptimistic,
  addConversationEnrollee,
  removeConversationEnrollee,
} from '@/store/slices/postsSlice';
import {
  addCommentOptimistic,
  removeCommentOptimistic,
} from '@/store/slices/commentsSlice';
import { isDemoActive } from './globalActions';

// ── Big-news notification helper ───────────────────────────────────────────

/**
 * Writes a `big_news_post` notification document so the Cloud Function fans
 * out FCM pushes to all channel subscribers (excluding the author).
 * Fire-and-forget — notification failures are non-fatal.
 */
async function sendBigNewsNotification(
  post: Post,
  authorFirstName: string,
  authorLastName: string,
  channelName: string,
  isDaily: boolean,
): Promise<void> {
  try {
    const notification: BigNewsPostNotification = {
      id: generateId('nano'),
      type: 'big_news_post',
      actorId: post.authorId,
      target: { type: 'channel_tier', channelId: post.channelId, tier: 'big-news' },
      createdAt: Date.now(),
      postId: post.id,
      channelId: post.channelId,
      channelName,
      isDaily,
      authorFirstName,
      authorLastName,
    };
    await createAppNotification(notification);
  } catch {
    // Notification delivery is best-effort; do not surface errors to the user
  }
}

// ── Upload a new post with optional media ──────────────────────────────────

// Helper to build a base Post object
function buildPost(params: {
  id: string;
  authorId: string;
  channelId: string;
  text: string;
  status: Post['status'];
  tier: PostTier;
}): Post {
  return {
    id: params.id,
    authorId: params.authorId,
    channelId: params.channelId,
    text: params.text.trim(),
    media: null,
    timestamp: Date.now(),
    reactions: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: params.status,
    tier: params.tier,
  };
}

export const uploadPost = createAsyncThunk(
  'posts/uploadPost',
  async (
    { channelId, text, media, tier = 'everyday' }: { channelId: string; text: string; media: MediaFile[]; tier?: PostTier },
    { rejectWithValue, getState, dispatch },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;

    if (!user) {
      return rejectWithValue('User not authenticated');
    }

    // Look up channel from state so we can pass authoritative isDaily / name
    // to the big-news notification without relying on ID string-matching.
    const allChannels = [
      ...state.channels.items,
      ...state.channels.connectionChannels,
    ];
    const channel = allChannels.find((c) => c.id === channelId);
    const channelIsDaily = channel?.isDaily ?? false;
    const channelName = channel?.name ?? '';

    const postId = generateId('nano');
    const hasMedia = media.length > 0;

    // In demo mode, just add the post to local state
    if (isDemoActive(getState)) {
      const demoPost = buildPost({ id: postId, authorId: user.id, channelId, text, status: 'ready', tier });
      dispatch(addPost(demoPost));
      return demoPost;
    }

    const uploadedUrls: string[] = [];

    try {
      // 1. Create post with status 'uploading' (or 'ready' if no media)
      const uploadingPost = buildPost({
        id: postId,
        authorId: user.id,
        channelId,
        text,
        status: hasMedia ? 'uploading' : 'ready',
        tier,
      });

      // Optimistically add the post to the store
      dispatch(addPost(uploadingPost));

      await createPost(uploadingPost);

      if (!hasMedia) {
        // Fire big-news notification for no-media posts immediately
        if (tier === 'big-news') {
          void sendBigNewsNotification(uploadingPost, user.firstName, user.lastName, channelName, channelIsDaily);
        }
        return uploadingPost;
      }

      // 2. Upload media files
      for (let i = 0; i < media.length; i++) {
        const file = media[i];
        const url = await uploadPostMedia(postId, file.uri, file.name, file.type);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length < media.length) {
        throw new Error('Failed to upload all media files');
      }

      // 3. Update post with media and status 'ready' (without waiting for thumbnails)
      const readyMedia: MediaItem[] = uploadedUrls.map((url, i) => ({
        url,
        type: media[i].type.startsWith('image') ? ('image' as const) : ('video' as const),
      }));

      await updatePost(postId, {
        media: readyMedia,
        status: 'ready',
      });

      const newPost: Post = {
        ...uploadingPost,
        media: readyMedia,
        status: 'ready',
      };

      // 4. Upload video thumbnails in the background (fire-and-forget).
      //    Once uploaded, the Firestore real-time listener will propagate the
      //    thumbnailUrl to all connected clients automatically.
      const hasVideoWithThumbnail = media.some(
        (f) => f.type.startsWith('video/') && f.thumbnailUri,
      );
      if (hasVideoWithThumbnail) {
        void (async () => {
          try {
            const withThumbs = [...readyMedia];
            let hadUpdate = false;
            await Promise.all(
              media.map(async (file, i) => {
                if (file.type.startsWith('video/') && file.thumbnailUri) {
                  try {
                    const thumbName = `${file.name.replace(/\.[^.]+$/, '')}_thumb.jpg`;
                    const thumbUrl = await uploadPostMedia(
                      postId,
                      file.thumbnailUri,
                      thumbName,
                      'image/jpeg',
                    );
                    withThumbs[i] = { ...withThumbs[i], thumbnailUrl: thumbUrl };
                    hadUpdate = true;
                  } catch {
                    // Thumbnail upload failure is non-fatal; the post is already live
                  }
                }
              }),
            );
            if (hadUpdate) {
              await updatePost(postId, { media: withThumbs });
            }
          } catch {
            // Silently ignore background thumbnail upload failures
          }
        })();
      }

      // Fire big-news notification after media post is ready
      if (tier === 'big-news') {
        void sendBigNewsNotification(newPost, user.firstName, user.lastName, channelName, channelIsDaily);
      }

      return newPost;
    } catch (err) {
      // Set post status to 'error' if post was created
      try {
        await updatePost(postId, { status: 'error' });
      } catch {
        // Ignore error if we fail to update post status
      }
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to create post',
      );
    }
  },
);

// ── Join conversation ──────────────────────────────────────────────────────

export const joinConversation = createAsyncThunk(
  'posts/joinConversation',
  async (
    { postId, userId }: { postId: string; userId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    // Optimistically add user to conversation enrollees
    dispatch(addConversationEnrollee({ postId, userId }));

    if (isDemoActive(getState)) {
      return { postId, userId };
    }
    try {
      await firestoreJoinConversation(postId, userId);
      return { postId, userId };
    } catch (err) {
      // Revert optimistic update on failure
      dispatch(removeConversationEnrollee({ postId, userId }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Add reaction with optimistic update ────────────────────────────────────

export const updatePostReactions = createAsyncThunk(
  'posts/updatePostReactions',
  async (
    { postId, newReaction }: { postId: string; newReaction: Reaction },
    { getState, dispatch, rejectWithValue },
  ) => {
    dispatch(updateReactionsOptimistic({ postId, newReaction }));
    if (isDemoActive(getState)) {
      return { postId, newReaction };
    }
    try {
      await addReactionToPost(postId, newReaction);
      return { postId, newReaction };
    } catch (err) {
      dispatch(revertReactionsOptimistic({ postId }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Remove reaction with optimistic update ─────────────────────────────────

export const removePostReaction = createAsyncThunk(
  'posts/removePostReaction',
  async (
    { postId, emoji, userId }: { postId: string; emoji: string; userId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    dispatch(removeReactionOptimistic({ postId, emoji, userId }));
    if (isDemoActive(getState)) {
      return { postId, emoji, userId };
    }
    try {
      await removeReactionFromPost(postId, { emoji, userId });
      return { postId, emoji, userId };
    } catch (err) {
      dispatch(revertReactionsOptimistic({ postId }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Add comment with optimistic update ─────────────────────────────────────

export const updatePostComments = createAsyncThunk(
  'posts/updatePostComments',
  async (
    { postId, newComment }: { postId: string; newComment: Comment },
    { getState, dispatch, rejectWithValue },
  ) => {
    dispatch(addCommentOptimistic({ postId, comment: newComment }));
    if (isDemoActive(getState)) {
      return { postId, newComment };
    }
    try {
      await addComment(postId, newComment);
      return { postId, newComment };
    } catch (err) {
      dispatch(removeCommentOptimistic({ postId, commentId: newComment.id }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
