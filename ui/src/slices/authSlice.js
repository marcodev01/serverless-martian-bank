import { createSlice } from '@reduxjs/toolkit';
import { Auth } from 'aws-amplify';

const initialState = {
  userInfo: localStorage.getItem('userInfo')
    ? JSON.parse(localStorage.getItem('userInfo'))
    : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.userInfo = action.payload;
      localStorage.setItem('userInfo', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.userInfo = null;
      localStorage.removeItem('userInfo');
      Auth.signOut(); 
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;