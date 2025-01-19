
import { stateSyncEnhancer } from 'electron-redux/renderer'
import { configureStore } from '@reduxjs/toolkit'

import reducers from '../../shared/redux/combinedReducer'

export const store = configureStore({
  reducer: {
    reducer:reducers
  },
  enhancers: [stateSyncEnhancer()],
});