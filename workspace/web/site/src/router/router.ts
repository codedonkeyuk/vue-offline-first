import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import TextDocumentView from "../views/TextDocumentView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "text document",
    component: TextDocumentView,
  },
  {
    path: "/test-bed",
    name: "test bed",
    // Example of lazy-loading a component with TypeScript
    component: () => import("../views/TestBedView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
