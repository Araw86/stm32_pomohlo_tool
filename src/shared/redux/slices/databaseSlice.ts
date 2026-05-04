import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  DatabaseMeta,
  DatabasePayload,
  DocumentEntry,
  Family,
  Subfamily,
  Device,
} from '../../types/database';

export interface DatabaseState {
  loaded: boolean;
  error: string | null;
  families: Family[];
  subfamilies: Subfamily[];
  documents: DocumentEntry[];
  devices: Device[];
  meta: DatabaseMeta | null;
}

const initialState: DatabaseState = {
  loaded: false,
  error: null,
  families: [],
  subfamilies: [],
  documents: [],
  devices: [],
  meta: null,
};

const databaseSlice = createSlice({
  name: 'databaseReducer',
  initialState,
  reducers: {
    setDatabase(state, action: PayloadAction<DatabasePayload>) {
      state.families = action.payload.families;
      state.subfamilies = action.payload.subfamilies;
      state.documents = action.payload.documents;
      state.devices = action.payload.devices;
      state.meta = action.payload.meta;
      state.loaded = true;
      state.error = null;
    },
    setDatabaseError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loaded = false;
    },
  },
});

export const { setDatabase, setDatabaseError } = databaseSlice.actions;
export default databaseSlice.reducer;
