import React from "react";
import ReactDOM from "react-dom/client";
import 'mdb-react-ui-kit/dist/css/mdb.min.css';
import "@fortawesome/fontawesome-free/css/all.min.css";
import App from "./App.jsx";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import store from "./store";
import { Provider } from "react-redux";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen.jsx";
import RegisterScreen from "./screens/RegisterScreen.jsx";
import ProfileScreen from "./screens/ProfileScreen.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import AtmScreen from "./screens/AtmScreen.jsx";
import NewAccScreen from "./screens/NewAccScreen.jsx";
import AccInfoScreen from "./screens/AccInfoScreen.jsx";
import TransferScreen from "./screens/TransferScreen.jsx";
import TransactionScreen from "./screens/TransactionScreen.jsx";
import LoanScreen from "./screens/LoanScreen.jsx";
import ApplyLoan from "./screens/ApplyLoanScreen.jsx";
import { Amplify } from 'aws-amplify';
import ApiUrls from "./slices/apiUrls.js";


Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: ApiUrls.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: ApiUrls.VITE_COGNITO_CLIENT_ID
    }
  }
});

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />}>
      <Route index={true} path="/" element={<HomeScreen />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/find-atm" element={<AtmScreen />} />
      <Route path="" element={<PrivateRoute />}>
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/new-account" element={<NewAccScreen />} />
        <Route path="/acc-info" element={<AccInfoScreen />} />
        <Route path="/transfer" element={<TransferScreen />} />
        <Route path="/transactions" element={<TransactionScreen />} />
        <Route path="/loan" element={<LoanScreen />} />
        <Route path="/new-loan" element={<ApplyLoan />} />
      </Route>
    </Route>
  )
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  </Provider>
);
