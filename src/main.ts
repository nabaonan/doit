import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "antdv-next/dist/antd.css";
import "./style.css";

const vueApp = createApp(App);
vueApp.use(createPinia());
vueApp.mount("#app");
