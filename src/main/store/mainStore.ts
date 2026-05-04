/*import redux */
import { applyMiddleware, configureStore, StoreEnhancer } from '@reduxjs/toolkit';
import { composeWithStateSync, stateSyncEnhancer } from 'electron-redux/main';


import {reducers} from '../../shared/redux/combinedReducer'

/*listener*/
import { createMainListeners } from './mainStoreListeners';

//middleware composeWithStateSync to share redux store in renderer and main
const middleware = applyMiddleware(createMainListeners().middleware)

const enhancer: StoreEnhancer = composeWithStateSync(middleware)

export const store = configureStore({
  reducer:reducers, 
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers({
      autoBatch: false,
    }).concat(enhancer),
});
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
