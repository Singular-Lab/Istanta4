// Tipi per importare la configurazione di Tailwind (scritta in JavaScript) nei test
declare module "*tailwind.config.js" {
  import type { Config } from "tailwindcss";
  const config: Config;
  export default config;
}
