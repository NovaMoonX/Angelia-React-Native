import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Post, Reaction, Comment, MediaItem } from '@/models/types';
import type { MediaFile } from '@/components/PostCreateMediaUploader';
import {
  createPost,
  updatePost,
  joinConversation as firestoreJoinConversation,
  addReactionToPost,
  removeReactionFromPost,
  addCommentToPost,
} from '@/services/firebase/firestore';
import { uploadPostMedia } from '@/services/firebase/storage';
import { generateId } from '@/utils/generateId';
import {
  addPost,
  updateReactionsOptimistic,
  removeReactionOptimistic,
  revertReactionsOptimistic,
  updateCommentsOptimistic,
  revertCommentsOptimistic,
} from '@/store/slices/postsSlice';

// ── Upload a new post with optional media ──────────────────────────────────

export const uploadPost = createAsyncThunk(
  'posts/uploadPost',
  async (
    { channelId, text, media }: { channelId: string; text: string; media: MediaFile[] },
    { rejectWithValue, getState, dispatch },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;

    if (!user) {
      return rejectWithValue('User not authenticated');
    }

    const postId = generateId('nano');
    const hasMedia = media.length > 0;
    const uploadedUrls: string[] = [];

    try {
      // 1. Create post with status 'uploading' (or 'ready' if no media)
      const uploadingPost: Post = {
        id: postId,
        authorId: user.id,
        channelId,
        text: text.trim(),
        media: null,
        timestamp: Date.now(),
        reactions: [],
        comments: [],
        conversationEnrollees: [],
        markedForDeletionAt: null,
        status: hasMedia ? 'uploading' : 'ready',
      };

      // Optimistically add the post to the store
      dispatch(addPost(uploadingPost));

      await createPost(uploadingPost);

      if (!hasMedia) {
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

      // 3. Update post with media and status 'ready'
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
    { rejectWithValue },
  ) => {
    try {
      await firestoreJoinConversation(postId, userId);
      return { postId, userId };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Add reaction with optimistic update ────────────────────────────────────

export const updatePostReactions = createAsyncThunk(
  'posts/updatePostReactions',
  async (
    { postId, newReaction }: { postId: string; newReaction: Reaction },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(updateReactionsOptimistic({ postId, newReaction }));
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
    { dispatch, rejectWithValue },
  ) => {
    dispatch(removeReactionOptimistic({ postId, emoji, userId }));
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
    { dispatch, rejectWithValue },
  ) => {
    dispatch(updateCommentsOptimistic({ postId, newComment }));
    try {
      await addCommentToPost(postId, newComment);
      return { postId, newComment };
    } catch (err) {
      dispatch(revertCommentsOptimistic({ postId }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
