import { test, expect } from '@playwright/test';

test('再生成409を表示し、選択と双方の編集を保持して最新情報で再試行できる', async ({ page }, info) => {
  const origin = process.env.E2E_BASE_URL!;
  const headers = { Origin: origin, 'X-Requested-With': 'kondo' };
  await page.goto('/');
  await page.getByTestId('login-email').fill('second@example.test');
  const loggedIn = page.waitForResponse(response => response.url().endsWith('/api/login') && response.request().method() === 'POST');
  await page.getByTestId('login-submit').click();
  const loginData = await (await loggedIn).json();
  const settings = page.getByTestId('trip-settings-screen');
  if (!loginData.brochure) {
    await expect(settings).toBeVisible();
    await settings.getByRole('checkbox').first().check();
    await settings.getByRole('button', { name: 'この内容で次の旅をつくる', exact: true }).click();
  }
  await expect(page.getByTestId('brochure')).toBeVisible();
  const session = await (await page.request.get('/api/session')).json();
  const localNote = `この画面で編集中の思い出-${Date.now()}`;
  const remoteNote = `別画面で保存済みの思い出-${Date.now()}`;
  const companion = session.brochure.companion === '親' ? '子ども' : '親';
  const card = page.locator('.category-card:not(.category-empty)').first();
  const name = await card.locator('h3').innerText();
  const spotId = session.spots.find((spot: { name: string }) => spot.name === name).id;
  const localItem = session.brochure.items.find((item: { spotId: string }) => item.spotId === spotId);
  const remoteItem = session.brochure.items.find((item: { id: string }) => item.id !== localItem.id);
  await card.locator('textarea').fill(localNote);
  await page.getByTestId('trip-settings-open').click();
  await settings.getByRole('checkbox').first().check();
  await settings.getByRole('radio', { name: companion, exact: true }).check();
  const remote = { revision: session.brochure.revision, companion: session.brochure.companion,
    duration: session.brochure.duration, tripStyle: session.brochure.tripStyle, template: session.brochure.template,
    items: session.brochure.items.map((item: { id: string; selected: boolean; isMemory: boolean; order: number; comment: string; pickupCategory: string | null }) => ({
      id: item.id, selected: item.selected, isMemory: item.isMemory, order: item.order,
      comment: item.id === remoteItem.id ? remoteNote : item.comment, pickupCategory: item.pickupCategory,
    })) };
  expect((await page.request.put('/api/brochure', { headers, data: remote })).status()).toBe(200);
  const conflict = page.waitForResponse(response => response.url().endsWith('/api/brochure/regenerate') && response.request().method() === 'POST');
  await settings.getByRole('button', { name: 'この内容で次の旅をつくる', exact: true }).click();
  const response = await conflict;
  expect(response.status()).toBe(409);
  expect((await response.json()).error.code).toBe('revision_conflict');
  await expect(settings.getByRole('alert')).toBeVisible();
  await expect(settings.getByRole('radio', { name: companion, exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath('regenerate-conflict.png'), fullPage: true });
  await settings.getByRole('button', { name: 'この画面の編集を保持して最新情報を取り込む', exact: true }).click({ timeout: 1500 });
  await expect(settings.getByRole('status').filter({ hasText: '最新' })).toBeVisible();
  await settings.getByRole('button', { name: 'この内容で次の旅をつくる', exact: true }).click();
  await expect(page.getByTestId('brochure')).toBeVisible();
  const saved = (await (await page.request.get('/api/session')).json()).brochure;
  expect(saved.companion).toBe(companion);
  expect(saved.items.find((item: { id: string }) => item.id === localItem.id).comment).toBe(localNote);
  expect(saved.items.find((item: { id: string }) => item.id === remoteItem.id).comment).toBe(remoteNote);
});
