import { createApp } from "vue";
import App from "./components/App.vue";
import { createJobDbPlugin } from "./plugins/jobDb.js";

const app = createApp(App);

app.use(createJobDbPlugin("job_search_local"));

app.mount("#root");
