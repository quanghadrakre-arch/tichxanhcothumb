import { bindings, defineConfig, defineWorker } from "cf/config";

// Ten Worker duoc doc luc build/deploy (khong phai luc request),
// nen co the truyen tu bien moi truong khi tao link workers.dev.
const workerName = process.env.WORKER_NAME?.trim() || "tichxanhcothumb";

// workers.dev dung ten Worker lam DNS label: <= 63 ky tu, chi chu/so/gach noi.
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(workerName)) {
  throw new Error(
    `WORKER_NAME "${workerName}" khong hop le: chi dung chu, so va dau "-" (toi da 63 ky tu, khong bat dau/ket thuc bang "-").`,
  );
}

export default defineConfig({
  accountId: "da62927cc0d48866b34e35dcb41e0bfd",
  worker: defineWorker({
    name: workerName,
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
