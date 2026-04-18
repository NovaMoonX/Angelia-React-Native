import { createAsyncThunk } from '@reduxjs/toolkit';
import { clearPosts, loadDemoPosts } from '@/store/slices/postsSlice';
import { clearChannels, loadDemoChannels } from '@/store/slices/channelsSlice';
import { clearUsers, loadDemoUsers } from '@/store/slices/usersSlice';
import { clearInvites, loadDemoInvites } from '@/store/slices/invitesSlice';
import { loadDemoMessages } from '@/store/slices/conversationSlice';
import {
  enterDemoMode as enterDemoModeAction,
  exitDemoMode as exitDemoModeAction,
} from '@/store/slices/demoSlice';
import { resetAllState } from '@/store/actions/globalActions';
import { DEMO_DATA } from '@/lib/demoData';

// Thunk to enter demo mode - loads all demo data
export const enterDemoMode = createAsyncThunk(
  'demo/enter',
  async (_, { dispatch }) => {
    // First, clear any existing data
    dispatch(clearPosts());
    dispatch(clearChannels());
    dispatch(clearUsers());
    dispatch(clearInvites());

    // Then load demo data
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    dispatch(loadDemoMessages(DEMO_DATA.messages));

    // Finally, activate demo mode
    dispatch(enterDemoModeAction());
  }
);

// Thunk to exit demo mode - clears all demo data
export const exitDemoMode = createAsyncThunk(
  'demo/exit',
  async (_, { dispatch }) => {
    // Exit demo mode and clear all state using global reset
    dispatch(exitDemoModeAction());
    dispatch(resetAllState());
  }
);
