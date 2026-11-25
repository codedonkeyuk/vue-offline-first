import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import TextDocumentView from "../views/TextDocumentView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "main",
    component: TextDocumentView,
  },
  {
    path: "/document/:id",
    name: "document",
    component: () => import("../views/TextDocumentEditorView.vue"),
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
