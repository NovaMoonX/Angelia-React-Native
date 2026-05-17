import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from '@/models/types';
import type { RootState } from '../index';
import { getActiveCustomChannelsByOwner } from '@/services/firebase/firestore';
import { resetAllState } from '../actions/globalActions';

export type PostLeaveSuggestionsStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PostLeaveSuggestionsEntry {
  status: PostLeaveSuggestionsStatus;
  channels: Channel[];
  fetchedAt: number | null;
  error: string | null;
  sourceRevision: number | null;
}

interface PostLeaveSuggestionsState {
  byKey: Record<string, PostLeaveSuggestionsEntry>;
}

const initialState: PostLeaveSuggestionsState = {
  byKey: {},
};

function buildEntryKey(viewerId: string, authorId: string): string {
  return `${viewerId}:${authorId}`;
}

export const ensurePostLeaveSuggestionsLoaded = createAsyncThunk<
  { key: string; channels: Channel[]; sourceRevision: number },
  { viewerId: string; authorId: string; sourceRevision: number },
  { state: RootState }
>(
  'postLeaveSuggestions/ensureLoaded',
  async ({ viewerId, authorId, sourceRevision }) => {
    const key = buildEntryKey(viewerId, authorId);
    const ownerCustomCircles = await getActiveCustomChannelsByOwner(authorId).catch(() => {
      return [];
    });

    const channels = ownerCustomCircles.filter((circle) => {
      if (circle.ownerId !== authorId) {
        return false;
      }
      if (circle.isDaily === true) {
        return false;
      }
      if (circle.markedForDeletionAt != null) {
        return false;
      }
      if (!circle.inviteCode) {
        return false;
      }
      if (circle.isPrivate === true) {
        return false;
      }
      if (circle.ownerId === viewerId) {
        return false;
      }
      if (circle.subscribers.includes(viewerId)) {
        return false;
      }
      return true;
    });

    return { key, channels, sourceRevision };
  },
  {
    condition: ({ viewerId, authorId, sourceRevision }, { getState }) => {
      const state = getState();
      const key = buildEntryKey(viewerId, authorId);
      const existing = state.postLeaveSuggestions.byKey[key];
      if (!existing) return true;
      if (existing.status === 'loading' && existing.sourceRevision === sourceRevision) return false;
      if (existing.status === 'success' && existing.sourceRevision === sourceRevision) return false;
      return true;
    },
  },
);

const postLeaveSuggestionsSlice = createSlice({
  name: 'postLeaveSuggestions',
  initialState,
  reducers: {
    clearPostLeaveSuggestionsForViewer(state, action: PayloadAction<{ viewerId: string }>) {
      const prefix = `${action.payload.viewerId}:`;
      const entries = Object.entries(state.byKey);
      const nextEntries = entries.filter(([key]) => {
        return !key.startsWith(prefix);
      });
      state.byKey = Object.fromEntries(nextEntries);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(ensurePostLeaveSuggestionsLoaded.pending, (state, action) => {
        const key = buildEntryKey(action.meta.arg.viewerId, action.meta.arg.authorId);
        const existing = state.byKey[key];
        state.byKey[key] = {
          status: 'loading',
          channels: existing?.channels ?? [],
          fetchedAt: existing?.fetchedAt ?? null,
          error: null,
          sourceRevision: action.meta.arg.sourceRevision,
        };
      })
      .addCase(ensurePostLeaveSuggestionsLoaded.fulfilled, (state, action) => {
        state.byKey[action.payload.key] = {
          status: 'success',
          channels: action.payload.channels,
          fetchedAt: Date.now(),
          error: null,
          sourceRevision: action.payload.sourceRevision,
        };
      })
      .addCase(ensurePostLeaveSuggestionsLoaded.rejected, (state, action) => {
        const key = buildEntryKey(action.meta.arg.viewerId, action.meta.arg.authorId);
        const existing = state.byKey[key];
        state.byKey[key] = {
          status: 'error',
          channels: existing?.channels ?? [],
          fetchedAt: existing?.fetchedAt ?? null,
          error: action.error.message ?? 'Failed to load suggestions',
          sourceRevision: action.meta.arg.sourceRevision,
        };
      })
      .addCase(resetAllState, () => initialState);
  },
});

export const { clearPostLeaveSuggestionsForViewer } = postLeaveSuggestionsSlice.actions;

export function selectPostLeaveSuggestionsEntry(
  state: RootState,
  viewerId: string,
  authorId: string,
): PostLeaveSuggestionsEntry | undefined {
  if (!viewerId || !authorId) {
    return undefined;
  }
  return state.postLeaveSuggestions.byKey[buildEntryKey(viewerId, authorId)];
}

export default postLeaveSuggestionsSlice.reducer;
