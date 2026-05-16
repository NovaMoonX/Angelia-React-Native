import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MobileAppConfig } from '@/services/firebase/firestore';

interface AppConfigState {
  mobileAppConfig: MobileAppConfig | null;
}

const initialState: AppConfigState = {
  mobileAppConfig: null,
};

const appConfigSlice = createSlice({
  name: 'appConfig',
  initialState,
  reducers: {
    setMobileAppConfig: (state, action: PayloadAction<MobileAppConfig | null>) => {
      state.mobileAppConfig = action.payload;
    },
  },
});

export const { setMobileAppConfig } = appConfigSlice.actions;
export default appConfigSlice.reducer;
