import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "da62927cc0d48866b34e35dcb41e0bfd",
  worker: defineWorker({
    name: "tichxanhcothumb",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-03",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
