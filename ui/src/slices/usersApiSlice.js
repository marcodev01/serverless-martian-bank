import { fetchBaseQuery, createApi } from "@reduxjs/toolkit/query/react";
import { signIn, signUp, signOut, updateUserAttributes } from 'aws-amplify/auth';


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
          const user = await signIn({ 
            username: data.email,
            password: data.password 
          });
          return { data: user };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
    register: builder.mutation({
      async queryFn(data) {
        try {
          await signUp({
            username: data.email,
            password: data.password,
            options: {  
              userAttributes: {
                email: data.email,
                given_name: data.name  
              }
            }
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
          await signOut();
          return { data: null };
        } catch (error) {
          return { error: error.message };
        }
      },
    }),
    updateUser: builder.mutation({
      async queryFn(data) {
        try {
          const result = await updateUserAttributes({
            attributes: {
              ...data
            }
          });
          return { data: result };
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
  useUpdateUserMutation
} = userApiSlice;