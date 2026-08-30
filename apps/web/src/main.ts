import { createApp } from "vue";

import App from "./App.vue";
import "./styles.css";

createApp(App).mount("#app");

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const notifyOfflineReady = () => {
    if (navigator.serviceWorker.controller) window.dispatchEvent(new Event("bazi-offline-ready"));
  };
  navigator.serviceWorker.addEventListener("controllerchange", notifyOfflineReady);
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(notifyOfflineReady)
      .catch(() => undefined);
  });
}
