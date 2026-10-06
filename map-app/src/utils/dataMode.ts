// src/utils/dataMode.ts
// Offline/static build: all data is served from this app's own /data and /locales.
// There is no backend, so "dynamic" mode does not exist here.

export type DataMode = "static";

export const DEFAULT_DATA_MODE: DataMode = "static";

export function getStaticBaseUrl() {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
}

export function computeExportBaseUrl(_mode: DataMode = "static"): string {
  return getStaticBaseUrl();
}

export function getBackendLoadPath(mode: DataMode = DEFAULT_DATA_MODE) {
  const base = computeExportBaseUrl(mode);

  return (lngs: string[], nss: string[]) => {
    const lng = lngs[0];
    const ns = nss[0];
    return `${base}/locales/${lng}/${ns}.yaml?build=${__BUILD_GIT_COMMIT__}`;
  };
}
