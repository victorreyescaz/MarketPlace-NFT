import { AppKitProvider } from "@reown/appkit/react";
import appKit from "./utils/appkit"; 
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppKitProvider appKit={appKit}>
      <App />
    </AppKitProvider>
  </React.StrictMode>
);



