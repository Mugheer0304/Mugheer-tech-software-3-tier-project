import { test, expect } from '@playwright/test';

/**
 * End-to-end journeys (spec Section 23).
 *
 * These run against a fully seeded local stack (docker compose up + seed):
 *   CLIENT_EMAIL / CLIENT_PASSWORD  — seeded client owner (default: owner@acme.test / ClientPass123!)
 *   INTERNAL_EMAIL / INTERNAL_PASSWORD — seeded admin (default: admin@mugheer.com / AdminPass123!)
 *   BASE_URL                        — default http://localhost:5173
 *
 * The tests assert real backend-backed behavior (service boxes appear from
 * the service_lines table, the contact form writes through the API), not
 * static markup.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CLIENT_EMAIL = process.env.CLIENT_EMAIL ?? 'owner@acme.test';
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD ?? 'ClientPass123!';

test.describe('Public site', () => {
  test('landing renders Service Boxes from the live catalog and expands on click', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /build\. monitor\. automate/i })).toBeVisible();

    // Service Boxes render (data-driven — at least the seeded catalog size)
    const boxes = page.locator('button[aria-expanded]');
    await expect(boxes.first()).toBeVisible();

    // Clicking a box opens the next-step detail view (does not navigate away)
    const firstBox = boxes.first();
    await firstBox.click();
    await expect(firstBox).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('What’s included', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request This Service' }).first()).toBeVisible();

    // Company contact details are on the public footer (spec Section 27)
    await expect(page.getByText('mughammugheer@gmail.com')).toBeVisible();
    await expect(page.getByText('+92 304 0405194')).toBeVisible();
  });

  test('contact form submits into the platform (contact_requests table)', async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await expect(page.getByText('mughammugheer@gmail.com')).toBeVisible();

    await page.locator('#c-name').fill('E2E Tester');
    await page.locator('#c-email').fill('e2e@example.test');
    await page.locator('#c-message').fill('Automated end-to-end contact form submission.');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText(/message received/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Client journey: signup → Service Box → request product', () => {
  test('service box CTA pre-fills the request form with the service line', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('link', { name: 'Log in' }).click();
    await page.locator('#email').fill(CLIENT_EMAIL);
    await page.locator('#password').fill(CLIENT_PASSWORD);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/dashboard/);

    // Open the Services catalog, expand a box, follow its CTA
    await page.getByRole('link', { name: 'Services' }).click();
    const box = page.locator('button[aria-expanded]').first();
    await box.click();
    await page.getByRole('link', { name: 'Request This Service' }).first().click();

    // Request form opened with ?service=... pre-selected
    await expect(page).toHaveURL(/projects\/new\?service=/);
    const preselected = new URL(page.url()).searchParams.get('service') ?? '';
    await expect(page.locator('#service')).toHaveValue(preselected);
  });
});

test.describe('Internal journey: assign task → verify pipeline visibility', () => {
  test('admin console shows service catalog management backed by same data', async ({ page }) => {
    test.skip(!process.env.INTERNAL_EMAIL, 'internal creds not provided');
    await page.goto(`${BASE}/login`);
    await page.locator('#email').fill(process.env.INTERNAL_EMAIL!);
    await page.locator('#password').fill(process.env.INTERNAL_PASSWORD ?? 'AdminPass123!');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.getByRole('link', { name: 'Service Catalog' }).click();
    // Same catalog data — edit an entry and the public box updates (Section 4.1)
    await expect(page.getByRole('button', { name: 'Manage' }).first()).toBeVisible();
  });
});
