import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type {
  Post,
  Reaction,
  Comment,
  MediaItem,
  PostTier,
  NewPostNotification,
  PostReactionNotification,
} from '@/models/types';
import type { MediaFile } from '@/components/PostCreateMediaUploader';
import {
  createPost,
  updatePost,
  joinConversation as firestoreJoinConversation,
  addReactionToPost,
  removeReactionsFromPostByUser,
  addComment,
  createAppNotification,
  deletePost as firestoreDeletePost,
} from '@/services/firebase/firestore';
import { uploadPostMedia } from '@/services/firebase/storage';
import { deletePostMediaByUrl } from '@/services/firebase/storage';
import { generateId } from '@/utils/generateId';
import {
  addPost,
  updateReactionsOptimistic,
  removeReactionsByUserOptimistic,
  revertReactionsOptimistic,
  addConversationEnrollee,
  removeConversationEnrollee,
  removePost,
  updatePostFields,
} from '@/store/slices/postsSlice';
import {
  addCommentOptimistic,
  removeCommentOptimistic,
} from '@/store/slices/commentsSlice';
import { isDemoActive } from './globalActions';

// ── Post notification helper ───────────────────────────────────────────────

/**
 * Writes a `new_post` notification document so the Cloud Function fans out
 * FCM pushes to all channel subscribers (excluding the author) and applies
 * per-circle preference filtering server-side.
 * Fire-and-forget — notification failures are non-fatal.
 */
async function sendPostNotification(
  post: Post,
  authorFirstName: string,
  authorLastName: string,
  channelName: string,
  isDaily: boolean,
  hasAttachments: boolean,
): Promise<void> {
  try {
    const notification: NewPostNotification = {
      id: generateId('nano'),
      type: 'new_post',
      actorId: post.authorId,
      target: {
        type: 'channel_tier',
        channelId: post.channelId,
        tier: post.tier ?? 'everyday',
      },
      createdAt: Date.now(),
      postId: post.id,
      channelId: post.channelId,
      channelName,
      isDaily,
      tier: post.tier ?? 'everyday',
      hasAttachments,
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
    lastEditedAt: null,
    reactions: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: params.status,
    tier: params.tier,
  };
}

function inferPostMediaType(mediaType: string): 'image' | 'video' | 'audio' {
  if (mediaType.startsWith('video/')) {
    return 'video';
  }
  if (mediaType.startsWith('audio/')) {
    return 'audio';
  }
  return 'image';
}

function getFileNameFromUri(uri: string, fallback: string): string {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname;
    const base = pathname.split('/').pop();
    if (base && base.length > 0) {
      return base;
    }
  } catch {
    // Non-URL strings are fine; fallback below
  }
  return fallback;
}

function getStorageObjectPathFromUrl(url: string): string | null {
  try {
    if (url.startsWith('gs://')) {
      const withoutScheme = url.replace(/^gs:\/\//, '');
      const firstSlash = withoutScheme.indexOf('/');
      if (firstSlash >= 0) {
        return withoutScheme.slice(firstSlash + 1);
      }
      return null;
    }

    const parsed = new URL(url);
    const objectSegment = '/o/';
    const objectIndex = parsed.pathname.indexOf(objectSegment);
    if (objectIndex < 0) {
      return null;
    }
    const encodedPath = parsed.pathname.slice(objectIndex + objectSegment.length);
    if (!encodedPath) {
      return null;
    }
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

function sameStorageObjectUrl(a: string, b: string): boolean {
  if (a === b) return true;
  const aPath = getStorageObjectPathFromUrl(a);
  const bPath = getStorageObjectPathFromUrl(b);
  return aPath != null && bPath != null && aPath === bPath;
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
        // Fire circle post notification for text-only posts immediately.
        void sendPostNotification(
          uploadingPost,
          user.firstName,
          user.lastName,
          channelName,
          channelIsDaily,
          false,
        );
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
        type: media[i].type.startsWith('image')
          ? ('image' as const)
          : media[i].type.startsWith('audio')
            ? ('audio' as const)
            : ('video' as const),
        caption: media[i].caption ?? null,
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

      // Fire circle post notification after media post is ready.
      void sendPostNotification(
        newPost,
        user.firstName,
        user.lastName,
        channelName,
        channelIsDaily,
        true,
      );

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
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;
    const post = state.posts.items.find((item) => {
      return item.id === postId;
    });

    dispatch(updateReactionsOptimistic({ postId, newReaction }));
    if (isDemoActive(getState)) {
      return { postId, newReaction };
    }
    try {
      await addReactionToPost(postId, newReaction);

      if (post && currentUser && post.authorId !== currentUser.id) {
        const notification: PostReactionNotification = {
          id: generateId('nano'),
          type: 'post_reaction',
          actorId: currentUser.id,
          target: { type: 'user', userId: post.authorId },
          createdAt: Date.now(),
          postId,
          reactorFirstName: currentUser.firstName,
          reactorLastName: currentUser.lastName,
          emoji: newReaction.emoji,
        };
        createAppNotification(notification).catch(() => {});
      }

      return { postId, newReaction };
    } catch (err) {
      dispatch(revertReactionsOptimistic({ postId }));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const removeAllPostReactionsForUser = createAsyncThunk(
  'posts/removeAllPostReactionsForUser',
  async (
    { postId, userId }: { postId: string; userId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    dispatch(removeReactionsByUserOptimistic({ postId, userId }));
    if (isDemoActive(getState)) {
      return { postId, userId };
    }
    try {
      await removeReactionsFromPostByUser(postId, userId);
      return { postId, userId };
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

// ── Delete a post ──────────────────────────────────────────────────────────

export const deletePostAction = createAsyncThunk(
  'posts/deletePost',
  async (
    { postId }: { postId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) {
      dispatch(removePost({ postId }));
      return postId;
    }
    
    try {
      await firestoreDeletePost(postId);
      dispatch(removePost({ postId }));
      return postId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const editPostContent = createAsyncThunk(
  'posts/editPostContent',
  async (
    {
      postId,
      channelId,
      text,
      media,
      tier = 'everyday',
    }: {
      postId: string;
      channelId: string;
      text: string;
      media: MediaFile[];
      tier?: PostTier;
    },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;

    if (!user) {
      return rejectWithValue('User not authenticated');
    }

    const existingPost = state.posts.items.find((item) => {
      return item.id === postId;
    });

    if (!existingPost) {
      return rejectWithValue('Post not found');
    }

    if (existingPost.authorId !== user.id) {
      return rejectWithValue('Only the author can edit this post');
    }

    const channelChanged = existingPost.channelId !== channelId;
    const allChannels = [
      ...state.channels.items,
      ...state.channels.connectionChannels,
    ];
    const destinationChannel = allChannels.find((c) => c.id === channelId);
    const destinationIsDaily = destinationChannel?.isDaily ?? false;
    const destinationChannelName = destinationChannel?.name ?? '';

    const uploadedNewMediaUrls: string[] = [];

    try {
      // 1) Upload newly-added media first.
      const preparedMedia = await Promise.all(
        media.map(async (item, index) => {
          const isExisting = Boolean(item.existingUrl);
          if (isExisting) {
            const existingUrl = item.existingUrl ?? '';
            const previous = (existingPost.media ?? []).find((m) => {
              return sameStorageObjectUrl(m.url, existingUrl);
            });
            return {
              // Reuse the canonical URL from Firestore when we can, so edit
              // round-trips don't persist a malformed/transcoded URL.
              url: previous?.url ?? existingUrl,
              type: inferPostMediaType(item.type),
              caption: item.caption ?? null,
              ...(previous?.thumbnailUrl ? { thumbnailUrl: previous.thumbnailUrl } : {}),
            };
          }

          const fileName = item.name || getFileNameFromUri(item.uri, `media-${Date.now()}-${index}`);
          const uploadedUrl = await uploadPostMedia(postId, item.uri, fileName, item.type);
          uploadedNewMediaUrls.push(uploadedUrl);

          let thumbnailUrl: string | null = null;
          if (item.type.startsWith('video/') && item.thumbnailUri) {
            const thumbName = `${fileName.replace(/\.[^.]+$/, '')}_thumb.jpg`;
            thumbnailUrl = await uploadPostMedia(postId, item.thumbnailUri, thumbName, 'image/jpeg');
            uploadedNewMediaUrls.push(thumbnailUrl);
          }

          return {
            url: uploadedUrl,
            type: inferPostMediaType(item.type),
            caption: item.caption ?? null,
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
          };
        }),
      );

      // 2) Verify removed media can be deleted from storage before saving post edits.
      const existingMedia = existingPost.media ?? [];
      const keptUrls = preparedMedia.map((item) => {
        return item.url;
      });
      const removedItems = existingMedia.filter((item) => {
        return !keptUrls.includes(item.url);
      });

      for (const removed of removedItems) {
        await deletePostMediaByUrl(removed.url);
        if (removed.thumbnailUrl) {
          await deletePostMediaByUrl(removed.thumbnailUrl);
        }
      }

      const editTimestamp = Date.now();
      const updatePayload: Partial<Post> = {
        channelId,
        text: text.trim(),
        media: preparedMedia,
        tier,
        lastEditedAt: editTimestamp,
        ...(channelChanged ? { timestamp: editTimestamp } : {}),
      };

      if (isDemoActive(getState)) {
        dispatch(updatePostFields({ postId, data: updatePayload }));
        return { postId, updated: updatePayload };
      }

      await updatePost(postId, updatePayload);
      if (channelChanged) {
        const republishedPost: Post = {
          ...existingPost,
          ...updatePayload,
          id: postId,
          authorId: existingPost.authorId,
          channelId,
          text: text.trim(),
          media: preparedMedia,
          reactions: existingPost.reactions,
          conversationEnrollees: existingPost.conversationEnrollees,
          markedForDeletionAt: existingPost.markedForDeletionAt,
          status: existingPost.status,
          tier,
          timestamp: editTimestamp,
          lastEditedAt: editTimestamp,
        };
        void sendPostNotification(
          republishedPost,
          user.firstName,
          user.lastName,
          destinationChannelName,
          destinationIsDaily,
          preparedMedia.length > 0,
        );
      }
      return { postId, updated: updatePayload };
    } catch (err) {
      // Best-effort cleanup for newly uploaded files when edit fails.
      await Promise.all(
        uploadedNewMediaUrls.map(async (url) => {
          try {
            await deletePostMediaByUrl(url);
          } catch {
            // Ignore cleanup failures
          }
        }),
      );

      return rejectWithValue(err instanceof Error ? err.message : 'Failed to edit post');
    }
  },
);
