/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
