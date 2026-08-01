import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

  // Un worker: todos los tests comparten la misma anvil y el mismo
  // public/deployments.json. En serie es determinista y se entiende.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  reporter: "list",

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },

  projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],

  // Playwright levanta las dos piezas y las reusa si ya están arriba,
  // así el mismo comando sirve en CI y mientras desarrollás.
  webServer: [
    {
      command: "anvil --silent",
      url: "http://127.0.0.1:8545",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // --host explicito: vite escucha en "localhost", que en CI
      // resuelve a ::1, y el chequeo de arriba prueba 127.0.0.1.
      // Sin esto el server levanta pero Playwright nunca lo ve.
      command: "pnpm vite --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
