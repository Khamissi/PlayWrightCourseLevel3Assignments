 import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/* Load SHOP_EMAIL / SHOP_PASSWORD from .env for local runs (Node's built-in loader, no dotenv needed).
   On GitHub Actions there is no .env: the values come from repository secrets instead. */
const envFile = path.resolve(__dirname, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Max time one whole test (including hooks) may run. Default: 30s */
  timeout: 60_000,
  /* Max time each expect() assertion retries, e.g. toHaveURL. Default: 5s */
  expect: {
    timeout: 15_000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry flaky tests 2 times, locally and on CI. A test that passes on a retry is reported as "flaky". */
  retries: 2,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters
     On CI: live progress in the job log + an HTML report that is uploaded as an artifact (never auto-opened). */
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect a trace when a failed test is retried, to debug flaky tests. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Max time each action (click, fill, ...) may take. Default: 0 = limited only by the test timeout */
    actionTimeout: 15_000,
    /* Max time page.goto() and navigations may take. Default: 0 = limited only by the test timeout */
    navigationTimeout: 30_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
