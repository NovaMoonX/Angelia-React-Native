import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Post, Reaction, Comment } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface PostsState {
  items: Post[];
  loaded: boolean;
  previousReactions: Record<string, Reaction[]>;
  previousComments: Record<string, Comment[]>;
}

const initialState: PostsState = {
  items: [],
  loaded: false,
  previousReactions: {},
  previousComments: {},
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts(state, action: PayloadAction<Post[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    addPost(state, action: PayloadAction<Post>) {
      state.items.unshift(action.payload);
    },
    clearPosts(state) {
      state.items = [];
      state.loaded = false;
    },
    loadDemoPosts(state, action: PayloadAction<Post[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    updateReactionsOptimistic(
      state,
      action: PayloadAction<{ postId: string; newReaction: Reaction }>
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        state.previousReactions[action.payload.postId] = [...post.reactions];
        post.reactions = [...post.reactions, action.payload.newReaction];
      }
    },
    removeReactionOptimistic(
      state,
      action: PayloadAction<{ postId: string; emoji: string; userId: string }>
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        state.previousReactions[action.payload.postId] = [...post.reactions];
        post.reactions = post.reactions.filter(
          (r) => !(r.emoji === action.payload.emoji && r.userId === action.payload.userId)
        );
      }
    },
    revertReactionsOptimistic(state, action: PayloadAction<{ postId: string }>) {
      const { postId } = action.payload;
      const post = state.items.find((p) => p.id === postId);
      if (post && state.previousReactions[postId]) {
        post.reactions = state.previousReactions[postId];
        delete state.previousReactions[postId];
      }
    },
    updateCommentsOptimistic(
      state,
      action: PayloadAction<{ postId: string; newComment: Comment }>
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        state.previousComments[action.payload.postId] = [...post.comments];
        post.comments = [...post.comments, action.payload.newComment];
      }
    },
    revertCommentsOptimistic(state, action: PayloadAction<{ postId: string }>) {
      const { postId } = action.payload;
      const post = state.items.find((p) => p.id === postId);
      if (post && state.previousComments[postId]) {
        post.comments = state.previousComments[postId];
        delete state.previousComments[postId];
      }
    },
    addConversationEnrollee(
      state,
      action: PayloadAction<{ postId: string; userId: string }>,
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post && !post.conversationEnrollees.includes(action.payload.userId)) {
        post.conversationEnrollees.push(action.payload.userId);
      }
    },
    removeConversationEnrollee(
      state,
      action: PayloadAction<{ postId: string; userId: string }>,
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        post.conversationEnrollees = post.conversationEnrollees.filter(
          (id) => id !== action.payload.userId,
        );
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setPosts,
  addPost,
  clearPosts,
  loadDemoPosts,
  updateReactionsOptimistic,
  removeReactionOptimistic,
  revertReactionsOptimistic,
  updateCommentsOptimistic,
  revertCommentsOptimistic,
  addConversationEnrollee,
  removeConversationEnrollee,
} = postsSlice.actions;

// Selectors
export const selectPostById = (state: RootState, postId: string) =>
  state.posts.items.find((p) => p.id === postId);

export const selectPostAuthor = (state: RootState, authorId: string) =>
  state.users.users.find((u) => u.id === authorId);

export const selectPostChannel = (state: RootState, channelId: string) =>
  state.channels.items.find((c) => c.id === channelId);

export default postsSlice.reducer;
