import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ConfigState {
  repoPath: string | null;
  /** When true, opening a doc that exists locally checks DB version and
   * prompts to download a newer one. */
  versionCheckOnOpen: boolean;
  /** When true, the app pings the database source on startup and prompts
   * the user to download a new release if one is available. */
  checkDatabaseOnStartup: boolean;
}

const initialState: ConfigState = {
  repoPath: null,
  versionCheckOnOpen: true,
  checkDatabaseOnStartup: true,
};

const configSlice = createSlice({
  name: 'configReducer',
  initialState,
  reducers: {
    setRepoPath(state, action: PayloadAction<string | null>) {
      state.repoPath = action.payload;
    },
    setVersionCheckOnOpen(state, action: PayloadAction<boolean>) {
      state.versionCheckOnOpen = action.payload;
    },
    setCheckDatabaseOnStartup(state, action: PayloadAction<boolean>) {
      state.checkDatabaseOnStartup = action.payload;
    },
  },
});

export const {
  setRepoPath,
  setVersionCheckOnOpen,
  setCheckDatabaseOnStartup,
} = configSlice.actions;
export default configSlice.reducer;
