/// <reference types="vitest" />
import { defineConfig } from "vite";
import siteConfig from "./site-config.json" with { type: "json" };
import { VitePWA } from "vite-plugin-pwa";
import vue from "@vitejs/plugin-vue";

export default defineConfig(() => {
  const authApiUrl = process.env.VITE_AUTH_API_URL || "http://localhost:4000";
  const couchBaseUrl =
    process.env.VITE_COUCH_BASE_URL || "http://localhost:5984";

  return {
    define: {
      "import.meta.env.VITE_AUTH_API_URL": JSON.stringify(authApiUrl),
      "import.meta.env.VITE_COUCH_BASE_URL": JSON.stringify(couchBaseUrl),
    },
    resolve: {
      alias: {
        events: "events",
      },
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: "index.html",
        },
        manifest: {
          name: siteConfig.appName,
          short_name: siteConfig.shortName,
          theme_color: siteConfig.themeColor,
          background_color: siteConfig.backgroundColor,
          display: "standalone",
          start_url: "/",
        },
        pwaAssets: {
          disabled: false,
          config: true,
        },
      }),
      {
        name: "native-html-transform",
        transformIndexHtml(html) {
          return html
            .replace(/<%- title %>/g, siteConfig.appName)
            .replace(/<%- metaDescription %>/g, siteConfig.metaDescription)
            .replace(/<%- publicSiteAddress %>/g, siteConfig.publicSiteAddress);
        },
      },
    ],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
    },
  };
});
