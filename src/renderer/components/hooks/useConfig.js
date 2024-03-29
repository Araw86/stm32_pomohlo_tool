import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { confResetState, dispatchConfiguration } from '../../redux/configurationSlice';
import { configurationLoad, configurationSave } from '../../utilities/configLoad';

/**
 * custom hook to check if the configuration is changed and save it
 * or load the configuration at the beginning of app start
 * @returns 
 */
function useConfig() {
  const configLoadStatus = useSelector((state) => state.configurationReducer.configLoadStatus)
  const oConfiguration = useSelector((state) => state.configurationReducer.configuration)

  const dispatch = useDispatch();

  /*load configuration */
  useEffect(() => {
    if (configLoadStatus === 0) {
      configurationLoad((configuration) => {
        dispatch(dispatchConfiguration({ configLoadStatus: 1, configuration: configuration }))
      });
    }
  }, []);

  /* handle the configuration change */
  useEffect(() => {
    /*config changes */
    /*store config */
    configurationSave(oConfiguration);
    dispatch(confResetState());
  }, [dispatch, oConfiguration]);
  return null;
}

export default useConfig