import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createTask as firestoreCreateTask,
  markTaskComplete as firestoreMarkTaskComplete,
} from '@/services/firebase/firestore';
import { removeTask } from '@/store/slices/tasksSlice';
import type { AppTask } from '@/models/types';
import { generateId } from '@/utils/generateId';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

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

    const state = getState() as RootState;
    const userId = state.users.currentUser?.id;
    if (!userId) return rejectWithValue('User not authenticated');

    const task: AppTask = {
      id: generateId('nano'),
      userId,
      type: 'invite_to_circle',
      channelId,
      channelName,
      createdAt: Date.now(),
      completedAt: null,
    };

    try {
      await firestoreCreateTask(task);
      return task;
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
