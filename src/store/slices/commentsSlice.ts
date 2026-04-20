import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Comment } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface CommentsState {
  /** Comments keyed by postId, fetched on demand (post detail / conversation screens). */
  byPostId: Record<string, Comment[]>;
}

const initialState: CommentsState = {
  byPostId: {},
};

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {
    setComments(state, action: PayloadAction<{ postId: string; comments: Comment[] }>) {
      state.byPostId[action.payload.postId] = action.payload.comments;
    },
    addCommentOptimistic(state, action: PayloadAction<{ postId: string; comment: Comment }>) {
      const existing = state.byPostId[action.payload.postId] ?? [];
      state.byPostId[action.payload.postId] = [...existing, action.payload.comment];
    },
    removeCommentOptimistic(
      state,
      action: PayloadAction<{ postId: string; commentId: string }>,
    ) {
      const existing = state.byPostId[action.payload.postId] ?? [];
      state.byPostId[action.payload.postId] = existing.filter(
        (c) => c.id !== action.payload.commentId,
      );
    },
    clearPostComments(state, action: PayloadAction<string>) {
      delete state.byPostId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setComments,
  addCommentOptimistic,
  removeCommentOptimistic,
  clearPostComments,
} = commentsSlice.actions;

export const selectComments = (state: RootState, postId: string): Comment[] =>
  state.comments.byPostId[postId] ?? [];

export default commentsSlice.reducer;
