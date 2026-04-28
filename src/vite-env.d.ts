/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LICENSE_KEYS?: string;
  readonly VITE_LICENSE_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
