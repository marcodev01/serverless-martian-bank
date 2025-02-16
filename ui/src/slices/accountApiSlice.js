/**
 * Copyright (c) 2023 Cisco Systems, Inc. and its affiliates All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

import { apiSlice } from "./usersApiSlice";
import ApiUrls from "./apiUrls";

const accsUrl = ApiUrls.VITE_ACCOUNTS_URL;

export const accountApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createAccount: builder.mutation({
      query: (data) => ({
        url: `${accsUrl}account/create`,
        method: "POST",
        prepareHeaders: (headers) => {
          headers.set("Content-Type", "multipart/form-data");
          return headers;
        },
        body: data,
      }),
    }),
    getAllAccounts: builder.mutation({
      query: (data) => ({
        url: `${accsUrl}account/allaccounts`,
        method: "POST",
        body: data,
        prepareHeaders: (headers) => {
          headers.set("Content-Type", "application/json");
          return headers;
        },
      }),
    }),
  }),
});

export const { useCreateAccountMutation, useGetAllAccountsMutation } = accountApiSlice;
