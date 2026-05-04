import { createSlice, PayloadAction } from '@reduxjs/toolkit'


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
    increment(slice,action: PayloadAction<null>){
      slice.testState1=slice.testState1+1;
    }
  }
});

/*export dispatch functions */
export const { increment } = testSlice.actions;
/* export reducer */
export default testSlice.reducer;
