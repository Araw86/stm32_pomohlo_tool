import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ConfigState {
  repoPath: string | null;
}

const initialState: ConfigState = {
  repoPath: null,
};

const configSlice = createSlice({
  name: 'configReducer',
  initialState,
  reducers: {
    setRepoPath(state, action: PayloadAction<string | null>) {
      state.repoPath = action.payload;
    },
  },
});

export const { setRepoPath } = configSlice.actions;
export default configSlice.reducer;
