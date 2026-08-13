import { test, expect } from '@playwright/test';

test('BeautyFit app loads and core flows work', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  // 1. Homepage loads
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await expect(page).toHaveTitle(/./);

  // 2. Navigate to Lipstick Fit (public feature, hits /api/v1/lipsticks)
  await page.goto('http://localhost:3000/lipstick-fit', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const bodyText = await page.textContent('body');
  expect(bodyText).toBeTruthy();

  // 3. Checkout plan page loads
  await page.goto('http://localhost:3000/checkout/plan', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const planText = await page.textContent('body');
  expect(planText).toContain('Choose Your Plan');

  // 4. Auth callback page (no token) should not crash
  await page.goto('http://localhost:3000/auth/callback', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 5. API smoke test through Vite proxy
  const lipstickResp = await page.request.get('http://localhost:3000/api/v1/lipsticks?limit=2');
  expect(lipstickResp.status()).toBe(200);
  const data = await lipstickResp.json();
  expect(data.items.length).toBeGreaterThan(0);

  // 6. Backend direct health
  const healthResp = await page.request.get('http://localhost:8000/health');
  expect(healthResp.status()).toBe(200);

  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors.slice(0, 10)));
  expect(
    consoleErrors.filter(
      (e) => e.includes('Failed to fetch') || e.includes('NetworkError')
    )
  ).toEqual([]);
});
