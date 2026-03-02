import React from "react";
import ReactDOM from "react-dom/client";
import { NotificationPopup } from "./components/notification/NotificationPopup";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotificationPopup />
  </React.StrictMode>,
);
