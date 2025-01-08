import { fetchBaseQuery, createApi } from "@reduxjs/toolkit/query/react";
import { Auth } from 'aws-amplify';

export const apiSlice = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: "" }),
  tagTypes: ["User"],
  endpoints: () => ({}),
});

export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      async queryFn(data) {
        try {
          const user = await Auth.signIn(data.email, data.password);
          return { data: user };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
    register: builder.mutation({
      async queryFn(data) {
        try {
          await Auth.signUp({
            username: data.email,
            password: data.password,
            attributes: { email: data.email }
          });
          return { data: { message: 'Registration successful' } };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
    logout: builder.mutation({
      async queryFn() {
        try {
          await Auth.signOut();
          return { data: null };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} = userApiSlice;