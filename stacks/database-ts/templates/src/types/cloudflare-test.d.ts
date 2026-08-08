/** Runtime bindings injected by the Cloudflare Vitest pool. */
declare module 'cloudflare:test' {
  export const env: Readonly<Record<string, string | undefined>>;
}
