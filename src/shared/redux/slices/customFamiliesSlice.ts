import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CustomFamilyPayload } from '../../types/customFamily';

/** Renderer-side mirror of the on-disk custom families.
 *
 * The main process is the source of truth — it reads the
 * `<userData>/local_databases/<id>/family.json` files and dispatches
 * updates here so the renderer (and the Documents tab) can render them
 * alongside the scraped main database. */
export interface CustomFamiliesState {
  loaded: boolean;
  families: CustomFamilyPayload[];
}

const initialState: CustomFamiliesState = {
  loaded: false,
  families: [],
};

const customFamiliesSlice = createSlice({
  name: 'customFamiliesReducer',
  initialState,
  reducers: {
    setCustomFamilies(
      state,
      action: PayloadAction<CustomFamilyPayload[]>,
    ) {
      state.families = action.payload;
      state.loaded = true;
    },
    upsertCustomFamily(
      state,
      action: PayloadAction<CustomFamilyPayload>,
    ) {
      const idx = state.families.findIndex(
        (f) => f.family.id === action.payload.family.id,
      );
      if (idx >= 0) {
        state.families[idx] = action.payload;
      } else {
        state.families.push(action.payload);
      }
    },
    removeCustomFamily(state, action: PayloadAction<string>) {
      state.families = state.families.filter(
        (f) => f.family.id !== action.payload,
      );
    },
  },
});

export const {
  setCustomFamilies,
  upsertCustomFamily,
  removeCustomFamily,
} = customFamiliesSlice.actions;
export default customFamiliesSlice.reducer;
