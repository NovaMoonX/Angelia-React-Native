import { configureStore } from '@reduxjs/toolkit';
import demoReducer from './slices/demoSlice';
import postsReducer from './slices/postsSlice';
import channelsReducer from './slices/channelsSlice';
import usersReducer from './slices/usersSlice';
import invitesReducer from './slices/invitesSlice';
import pendingInviteReducer from './slices/pendingInviteSlice';

export const store = configureStore({
  reducer: {
    demo: demoReducer,
    posts: postsReducer,
    channels: channelsReducer,
    users: usersReducer,
    invites: invitesReducer,
    pendingInvite: pendingInviteReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
