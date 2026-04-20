import { configureStore } from '@reduxjs/toolkit';
import demoReducer from './slices/demoSlice';
import postsReducer from './slices/postsSlice';
import channelsReducer from './slices/channelsSlice';
import usersReducer from './slices/usersSlice';
import invitesReducer from './slices/invitesSlice';
import pendingInviteReducer from './slices/pendingInviteSlice';
import conversationReducer from './slices/conversationSlice';
import connectionsReducer from './slices/connectionsSlice';
import commentsReducer from './slices/commentsSlice';

export const store = configureStore({
  reducer: {
    demo: demoReducer,
    posts: postsReducer,
    channels: channelsReducer,
    users: usersReducer,
    invites: invitesReducer,
    pendingInvite: pendingInviteReducer,
    conversation: conversationReducer,
    connections: connectionsReducer,
    comments: commentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
