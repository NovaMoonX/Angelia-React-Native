import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { Comment } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface CommentsState {
  /** Comments keyed by postId. */
  commentsByPost: Record<string, Comment[]>;
}

const initialState: CommentsState = {
  commentsByPost: {},
};

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {
    setComments(
      state,
      action: PayloadAction<{ postId: string; comments: Comment[] }>,
    ) {
      state.commentsByPost[action.payload.postId] = action.payload.comments;
    },
    addCommentOptimistic(
      state,
      action: PayloadAction<{ postId: string; comment: Comment }>,
    ) {
      const { postId, comment } = action.payload;
      if (!state.commentsByPost[postId]) {
        state.commentsByPost[postId] = [];
      }
      if (!state.commentsByPost[postId].some((c) => c.id === comment.id)) {
        state.commentsByPost[postId].push(comment);
      }
    },
    removeCommentOptimistic(
      state,
      action: PayloadAction<{ postId: string; commentId: string }>,
    ) {
      const { postId, commentId } = action.payload;
      if (state.commentsByPost[postId]) {
        state.commentsByPost[postId] = state.commentsByPost[postId].filter(
          (c) => c.id !== commentId,
        );
      }
    },
    clearComments(state, action: PayloadAction<string>) {
      delete state.commentsByPost[action.payload];
    },
    loadDemoComments(
      state,
      action: PayloadAction<Record<string, Comment[]>>,
    ) {
      state.commentsByPost = { ...state.commentsByPost, ...action.payload };
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
  clearComments,
  loadDemoComments,
} = commentsSlice.actions;

// Selectors
const EMPTY_COMMENTS: Comment[] = [];

export const selectComments = createSelector(
  [
    (state: RootState) => state.comments.commentsByPost,
    (_state: RootState, postId: string) => postId,
  ],
  (commentsByPost, postId) => commentsByPost[postId] ?? EMPTY_COMMENTS,
);

export default commentsSlice.reducer;
