/*import redux */
import { configureStore } from '@reduxjs/toolkit';
import { stateSyncEnhancer } from 'electron-redux/main';


import {reducers} from '../../shared/redux/combinedReducer'

export const store = configureStore({
  reducer:reducers, 
  enhancers: [stateSyncEnhancer()],
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
