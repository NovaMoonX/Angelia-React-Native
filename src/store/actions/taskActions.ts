import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createTask as firestoreCreateTask,
  markTaskComplete as firestoreMarkTaskComplete,
} from '@/services/firebase/firestore';
import { removeTask } from '@/store/slices/tasksSlice';
import type { AppTask, TaskType } from '@/models/types';
import { generateId } from '@/utils/generateId';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

/** Internal helper to create any task type. */
async function makeTask(
  getState: () => unknown,
  type: TaskType,
  extra?: { channelId?: string; channelName?: string },
): Promise<AppTask | null> {
  const state = getState() as RootState;
  const userId = state.users.currentUser?.id;
  if (!userId) return null;

  const task: AppTask = {
    id: generateId('nano'),
    userId,
    type,
    ...extra,
    createdAt: Date.now(),
    completedAt: null,
  };
  await firestoreCreateTask(task);
  return task;
}

/**
 * Creates an invite-to-circle task for the given channel.
 * No-ops in demo mode.
 */
export const createInviteCircleTask = createAsyncThunk(
  'tasks/createInviteCircle',
  async (
    { channelId, channelName }: { channelId: string; channelName: string },
    { getState, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, 'invite_to_circle', { channelId, channelName });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "set your fun fact / bio" task. No-ops in demo mode. */
export const createSetFunFactTask = createAsyncThunk(
  'tasks/createSetFunFact',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, 'set_fun_fact');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "set your first status" task. No-ops in demo mode. */
export const createSetStatusTask = createAsyncThunk(
  'tasks/createSetStatus',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, 'set_status');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "create your first custom circle" task. No-ops in demo mode. */
export const createCustomCircleTask = createAsyncThunk(
  'tasks/createCustomCircle',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, 'create_custom_circle');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "make your first post" task. No-ops in demo mode. */
export const createMakeFirstPostTask = createAsyncThunk(
  'tasks/createMakeFirstPost',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, 'make_first_post');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Marks a task as completed (removes it from the active task list).
 */
export const completeTask = createAsyncThunk(
  'tasks/complete',
  async (taskId: string, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) {
      dispatch(removeTask(taskId));
      return taskId;
    }

    const state = getState() as RootState;
    const userId = state.users.currentUser?.id;
    if (!userId) return rejectWithValue('User not authenticated');

    try {
      await firestoreMarkTaskComplete(userId, taskId);
      dispatch(removeTask(taskId));
      return taskId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
