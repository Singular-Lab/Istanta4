/// <reference types="vite/client" />

export interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ENVIRONMENT: string
  readonly VITE_OLYMPO_URL: string
  // more env variables...
}

export interface ImportMeta {
  readonly env: ImportMetaEnv
}
