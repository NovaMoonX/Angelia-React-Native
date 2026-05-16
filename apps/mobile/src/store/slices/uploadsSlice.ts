import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import { resetAllState } from '../actions/globalActions';

export type PostUploadStatus = 'queued' | 'uploading' | 'finalizing' | 'error';

export interface PostUploadProgress {
  postId: string;
  status: PostUploadStatus;
  progress: number;
  updatedAt: number;
  errorMessage: string | null;
}

interface UploadsState {
  byPostId: Record<string, PostUploadProgress>;
}

const initialState: UploadsState = {
  byPostId: {},
};

const uploadsSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    setPostUploadQueued(state, action: PayloadAction<{ postId: string }>) {
      const { postId } = action.payload;
      state.byPostId[postId] = {
        postId,
        status: 'queued',
        progress: 0,
        updatedAt: Date.now(),
        errorMessage: null,
      };
    },
    setPostUploadProgress(state, action: PayloadAction<{ postId: string; progress: number }>) {
      const { postId, progress } = action.payload;
      const prev = state.byPostId[postId];
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const monotonicProgress = Math.max(prev?.progress ?? 0, clampedProgress);
      state.byPostId[postId] = {
        ...(prev ?? {}),
        postId,
        status: 'uploading',
        progress: monotonicProgress,
        updatedAt: Date.now(),
        errorMessage: null,
      };
    },
    setPostUploadFinalizing(state, action: PayloadAction<{ postId: string }>) {
      const { postId } = action.payload;
      const prev = state.byPostId[postId];
      state.byPostId[postId] = {
        postId,
        status: 'finalizing',
        progress: Math.max(prev?.progress ?? 0, 0.98),
        updatedAt: Date.now(),
        errorMessage: null,
      };
    },
    setPostUploadError(state, action: PayloadAction<{ postId: string; errorMessage: string }>) {
      const { postId, errorMessage } = action.payload;
      const prev = state.byPostId[postId];
      state.byPostId[postId] = {
        postId,
        status: 'error',
        progress: prev?.progress ?? 0,
        updatedAt: Date.now(),
        errorMessage,
      };
    },
    clearPostUploadProgress(state, action: PayloadAction<{ postId: string }>) {
      delete state.byPostId[action.payload.postId];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setPostUploadQueued,
  setPostUploadProgress,
  setPostUploadFinalizing,
  setPostUploadError,
  clearPostUploadProgress,
} = uploadsSlice.actions;

export const selectUploadProgressByPostId = (state: RootState) => state.uploads.byPostId;

export default uploadsSlice.reducer;
