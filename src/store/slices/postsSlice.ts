import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Post, Reaction, Comment } from '@/models/types';
import type { RootState } from '../index';

interface PostsState {
  items: Post[];
  previousReactions: Record<string, Reaction[]>;
  previousComments: Record<string, Comment[]>;
}

const initialState: PostsState = {
  items: [],
  previousReactions: {},
  previousComments: {},
};

const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    setPosts(state, action: PayloadAction<Post[]>) {
      state.items = action.payload;
    },
    addPost(state, action: PayloadAction<Post>) {
      state.items.unshift(action.payload);
    },
    clearPosts(state) {
      state.items = [];
    },
    loadDemoPosts(state, action: PayloadAction<Post[]>) {
      state.items = action.payload;
    },
    updateReactionsOptimistic(
      state,
      action: PayloadAction<{ postId: string; reactions: Reaction[] }>
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        state.previousReactions[action.payload.postId] = [...post.reactions];
        post.reactions = action.payload.reactions;
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
    revertReactionsOptimistic(state, action: PayloadAction<string>) {
      const postId = action.payload;
      const post = state.items.find((p) => p.id === postId);
      if (post && state.previousReactions[postId]) {
        post.reactions = state.previousReactions[postId];
        delete state.previousReactions[postId];
      }
    },
    updateCommentsOptimistic(
      state,
      action: PayloadAction<{ postId: string; comments: Comment[] }>
    ) {
      const post = state.items.find((p) => p.id === action.payload.postId);
      if (post) {
        state.previousComments[action.payload.postId] = [...post.comments];
        post.comments = action.payload.comments;
      }
    },
    revertCommentsOptimistic(state, action: PayloadAction<string>) {
      const postId = action.payload;
      const post = state.items.find((p) => p.id === postId);
      if (post && state.previousComments[postId]) {
        post.comments = state.previousComments[postId];
        delete state.previousComments[postId];
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase('RESET_ALL_STATE', () => initialState);
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
} = postsSlice.actions;

// Selectors
export const selectPostById = (state: RootState, postId: string) =>
  state.posts.items.find((p) => p.id === postId);

export const selectPostAuthor = (state: RootState, authorId: string) =>
  state.users.users.find((u) => u.id === authorId);

export const selectPostChannel = (state: RootState, channelId: string) =>
  state.channels.items.find((c) => c.id === channelId);

export default postsSlice.reducer;
