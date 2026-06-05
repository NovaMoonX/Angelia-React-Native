import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConnectionNickname } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface ConnectionNicknamesState {
  /** targetUserId → nickname */
  nicknames: Record<string, string>;
  loaded: boolean;
}

const initialState: ConnectionNicknamesState = {
  nicknames: {},
  loaded: false,
};

const connectionNicknamesSlice = createSlice({
  name: 'connectionNicknames',
  initialState,
  reducers: {
    setConnectionNicknames(state, action: PayloadAction<ConnectionNickname[]>) {
      const map: Record<string, string> = {};
      for (const entry of action.payload) {
        if (entry.nickname?.trim()) {
          map[entry.targetUserId] = entry.nickname.trim();
        }
      }
      state.nicknames = map;
      state.loaded = true;
    },
    setConnectionNickname(state, action: PayloadAction<{ targetUserId: string; nickname: string }>) {
      const { targetUserId, nickname } = action.payload;
      const trimmed = nickname.trim();
      if (trimmed) {
        state.nicknames[targetUserId] = trimmed;
      } else {
        delete state.nicknames[targetUserId];
      }
    },
    removeConnectionNickname(state, action: PayloadAction<string>) {
      delete state.nicknames[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setConnectionNicknames,
  setConnectionNickname,
  removeConnectionNickname,
} = connectionNicknamesSlice.actions;

export const selectConnectionNicknamesMap = (state: { connectionNicknames: ConnectionNicknamesState }) => {
  return state.connectionNicknames.nicknames;
};

export const selectNicknameForUser = (userId: string) => {
  return (state: { connectionNicknames: ConnectionNicknamesState }) => {
    return state.connectionNicknames.nicknames[userId] ?? null;
  };
};

export default connectionNicknamesSlice.reducer;
