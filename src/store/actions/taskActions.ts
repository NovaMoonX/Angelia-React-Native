import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createTask as firestoreCreateTask,
  markTaskComplete as firestoreMarkTaskComplete,
} from '@/services/firebase/firestore';
import { addTask, removeTask } from '@/store/slices/tasksSlice'; // addTask imported for rollback on write failure
import type { AppTask, TaskType } from '@/models/types';
import { generateId } from '@/utils/generateId';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

/** Internal helper to create any task type. */
async function makeTask(
  getState: () => unknown,
  dispatch: (action: unknown) => void,
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
  // Optimistically add to Redux state before the Firestore write
  dispatch(addTask(task));
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
    { getState, dispatch, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, dispatch, 'invite_to_circle', { channelId, channelName });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "set your fun fact / bio" task. No-ops in demo mode. */
export const createSetFunFactTask = createAsyncThunk(
  'tasks/createSetFunFact',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, dispatch, 'set_fun_fact');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "set your first status" task. No-ops in demo mode. */
export const createSetStatusTask = createAsyncThunk(
  'tasks/createSetStatus',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, dispatch, 'set_status');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "create your first custom circle" task. No-ops in demo mode. */
export const createCustomCircleTask = createAsyncThunk(
  'tasks/createCustomCircle',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, dispatch, 'create_custom_circle');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/** Creates a "make your first post" task. No-ops in demo mode. */
export const createMakeFirstPostTask = createAsyncThunk(
  'tasks/createMakeFirstPost',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;
    try {
      return await makeTask(getState, dispatch, 'make_first_post');
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Marks a task as completed (removes it from the active task list).
 *
 * removeTask is dispatched OPTIMISTICALLY before the Firestore write, consistent
 * with how addTask is handled in makeTask. This prevents useAutoCompleteTasks from
 * re-dispatching the same task while the async write is in-flight (the task would
 * still appear in pendingTasks until the write resolves, causing duplicate dispatches
 * and UI flickering).
 *
 * If the Firestore write fails, the task is re-added to pendingTasks so it can be
 * retried by useAutoCompleteTasks on the next effect run.
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
    const task = state.tasks.items.find((t) => { return t.id === taskId; });
    
    if (!userId) return rejectWithValue('User not authenticated');
    if (!task) return rejectWithValue('Task not found');

    // Optimistically remove from Redux immediately so the task leaves pendingTasks
    // before any effect re-run can see it and re-dispatch completeTask for the same ID.
    dispatch(removeTask(taskId));

    try {
      await firestoreMarkTaskComplete(userId, taskId);
      return taskId;
    } catch (err) {
      // Re-add the task so it remains in pendingTasks and can be retried.
      dispatch(addTask(task));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
