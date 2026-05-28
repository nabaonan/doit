import { createApp } from "vue";
import App from "./App.vue";
import {
  Button,
  Input,
  InputPassword,
  Switch,
  Slider,
  Radio,
  RadioGroup,
  Modal,
  Dropdown,
  Segmented,
  Menu,
  ColorPicker,
  Checkbox,
  Tag,
  Select,
  SelectOption,
  ConfigProvider,
  App as AppProvider,
  Empty,
} from "antdv-next";
import "antdv-next/dist/antd.css";
import "./style.css";

const vueApp = createApp(App);

const components = [Button, Input, InputPassword, Switch, Slider, Radio, RadioGroup, Modal, Dropdown, Segmented,
  Menu, ColorPicker, Checkbox, Tag, Select, SelectOption, ConfigProvider, AppProvider, Empty];
for (const comp of components) {
  vueApp.component((comp as any).name, comp);
}

vueApp.mount("#app");