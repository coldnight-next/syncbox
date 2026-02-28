/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  readonly MAIN_VITE_CLERK_PUBLISHABLE_KEY?: string
  readonly MAIN_VITE_CLERK_SECRET_KEY?: string
  readonly MAIN_VITE_CLERK_OAUTH_CLIENT_ID?: string
  readonly MAIN_VITE_CLERK_REDIRECT_URI?: string
  readonly MAIN_VITE_RELAY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
