import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppTask } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface TasksState {
  items: AppTask[];
  loaded: boolean;
}

const initialState: TasksState = {
  items: [],
  loaded: false,
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setTasks(state, action: PayloadAction<AppTask[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    addTask(state, action: PayloadAction<AppTask>) {
      const exists = state.items.some((t) => t.id === action.payload.id);
      if (!exists) {
        state.items.push(action.payload);
      }
    },
    removeTask(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const { setTasks, addTask, removeTask } = tasksSlice.actions;
export default tasksSlice.reducer;
