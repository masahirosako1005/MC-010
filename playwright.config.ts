import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:process.env.E2E_BASE_URL??'http://127.0.0.1:3001',channel:process.env.PLAYWRIGHT_CHANNEL??(process.platform==='win32'?'msedge':'chromium'),headless:true,trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
});
