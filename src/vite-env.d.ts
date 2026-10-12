/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

/** Version de `package.json`, injectée par Vite (`define`). */
declare const __APP_VERSION__: string;
