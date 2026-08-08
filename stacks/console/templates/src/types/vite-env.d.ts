/** Public environment values replaced statically by Vite. */
interface ImportMetaEnv {
  readonly VITE_ENV: string | undefined;
  readonly VITE_API_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
