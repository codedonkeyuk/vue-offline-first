import { createApp } from "vue";
import App from "./App.vue";
import { createJobDbPlugin } from "./plugins/jobDb.js";
import router from "./router/router.js";

const app = createApp(App);

app.use(createJobDbPlugin("job_search_local"));
app.use(router);
app.mount("#root");
