import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserInboxItem } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface UserInboxState {
  items: UserInboxItem[];
  loaded: boolean;
}

const initialState: UserInboxState = {
  items: [],
  loaded: false,
};

const userInboxSlice = createSlice({
  name: 'userInbox',
  initialState,
  reducers: {
    setUserInboxItems(state, action: PayloadAction<UserInboxItem[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => {
      return initialState;
    });
  },
});

export const { setUserInboxItems } = userInboxSlice.actions;
export default userInboxSlice.reducer;
