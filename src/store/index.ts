import { configureStore } from '@reduxjs/toolkit';
import demoReducer from './slices/demoSlice';
import postsReducer from './slices/postsSlice';
import channelsReducer from './slices/channelsSlice';
import usersReducer from './slices/usersSlice';
import invitesReducer from './slices/invitesSlice';
import pendingInviteReducer from './slices/pendingInviteSlice';
import conversationReducer from './slices/conversationSlice';
import commentsReducer from './slices/commentsSlice';
import connectionsReducer from './slices/connectionsSlice';
import tasksReducer from './slices/tasksSlice';
import privateNotesReducer from './slices/privateNotesSlice';

export const store = configureStore({
  reducer: {
    demo: demoReducer,
    posts: postsReducer,
    channels: channelsReducer,
    users: usersReducer,
    invites: invitesReducer,
    pendingInvite: pendingInviteReducer,
    conversation: conversationReducer,
    comments: commentsReducer,
    connections: connectionsReducer,
    tasks: tasksReducer,
    privateNotes: privateNotesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
