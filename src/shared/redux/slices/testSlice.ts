import { createSlice } from '@reduxjs/toolkit'


export interface TestInterface {
  testState1: number;
}


const initialState: TestInterface = {
  testState1:0

}


const testSlice = createSlice({
  name:'testReducer',
  initialState,
  reducers:{

  }
});

export default testSlice.reducer;
