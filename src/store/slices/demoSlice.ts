import { createSlice } from '@reduxjs/toolkit';

interface DemoState {
  isActive: boolean;
}

const initialState: DemoState = {
  isActive: false,
};

const demoSlice = createSlice({
  name: 'demo',
  initialState,
  reducers: {
    enterDemoMode(state) {
      state.isActive = true;
    },
    exitDemoMode(state) {
      state.isActive = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase('RESET_ALL_STATE', () => initialState);
  },
});

export const { enterDemoMode, exitDemoMode } = demoSlice.actions;
export default demoSlice.reducer;
