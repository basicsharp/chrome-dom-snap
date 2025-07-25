// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright-tests',
  fullyParallel: false, // Don't run extension tests in parallel
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only one worker for extension tests
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome extension specific settings
        channel: 'chrome',
        launchOptions: {
          // Required for extension testing
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions-except=./dist',
            '--load-extension=./dist',
          ]
        }
      },
    },
  ],

  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },
}); 