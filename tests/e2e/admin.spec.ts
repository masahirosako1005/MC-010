import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

async function townLogin(page: Page) {
  await page.goto('/');
  await page.getByTestId('login-email').fill('town@example.test');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: '概況', exact: true })).toBeVisible();
}

test('町ログインから概況・登録一覧・スポット作成編集・写真再試行・公開停止再開・復元', async ({ page }, info) => {
  await townLogin(page);
  await expect(page.getByText('町管理', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'パンフレット作成済み' })).toBeVisible();
  await expect(page.getByRole('button', { name: '共有状況', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('admin-overview.png'), fullPage: true });
  await page.getByRole('button', { name: 'パンフレット登録状況', exact: true }).click();
  await page.getByRole('combobox', { name: '登録状態', exact: true }).selectOption('missing');
  await page.getByRole('combobox', { name: '訪問履歴', exact: true }).selectOption('no');
  await expect(page.getByRole('table')).toContainText('履歴なし');
  await page.screenshot({ path: info.outputPath('admin-registrations.png'), fullPage: true });
  await page.getByRole('button', { name: 'スポット管理', exact: true }).click();
  await page.getByRole('button', { name: 'スポットを登録', exact: true }).click();
  const editor = page.locator('.admin-editor'), name = `画面検証スポット-${info.project.name}-${Date.now()}`;
  await editor.getByLabel(/^スポット名/).fill(name);
  await editor.getByLabel(/^紹介文/).fill('テスト専用DBのスポットです。');
  await page.route('**/api/admin/spots/*/photo', route => route.fulfill({ status: 503, json: { error: { code: 'retry_test', message: '写真保存に失敗しました。' } } }));
  await editor.getByLabel('写真を追加・差し替え', { exact: true }).setInputFiles(path.resolve('public/assets/lake.png'));
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('写真はこの画面に残っています');
  await expect(editor.getByAltText('スポット画像プレビュー')).toHaveAttribute('src', /^blob:/);
  await page.unroute('**/api/admin/spots/*/photo');
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('スポットを保存しました');
  await expect(editor.getByAltText('スポット画像プレビュー')).toHaveAttribute('src', /^\/api\/spot-photos\//);
  await editor.getByLabel('公開する', { exact: false }).uncheck();
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('スポットを保存しました');
  await editor.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('スポットを検索', { exact: true }).fill(name);
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('公開停止');
  await row.getByRole('button', { name: `${name}を編集`, exact: true }).click();
  await editor.getByLabel('公開する', { exact: false }).check();
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('スポットを保存しました');
  await page.screenshot({ path: info.outputPath('admin-spot-editor.png'), fullPage: true });
  for (const width of [320, 390, 844, 1440]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click();
  await townLogin(page);
  await page.getByRole('button', { name: 'スポット管理', exact: true }).click();
  await page.getByLabel('スポットを検索', { exact: true }).fill(name);
  await expect(page.getByRole('row').filter({ hasText: name })).toContainText('公開中');
});

test('別画面更新との競合後も入力と写真を保持して最新revisionで再試行できる', async ({ page }, info) => {
  await townLogin(page);
  await page.getByRole('button', { name: 'スポット管理', exact: true }).click();
  const spots = (await (await page.request.get('/api/admin/spots')).json()).spots;
  const spot = spots[0];
  await page.getByRole('button', { name: `${spot.name}を編集`, exact: true }).click();
  const editor = page.locator('.admin-editor');
  const localDescription = `競合しても保持する入力-${info.project.name}-${Date.now()}`;
  await editor.getByLabel(/^紹介文/).fill(localDescription);
  await editor.getByLabel('写真を追加・差し替え', { exact: true }).setInputFiles(path.resolve('public/assets/coast.png'));
  const origin = new URL(page.url()).origin;
  const concurrent = await page.request.put(`/api/admin/spots/${spot.id}`, { headers: { Origin: origin, 'X-Requested-With': 'kondo' }, data: { name: spot.name, category: spot.category, description: '別画面での更新', themeTags: spot.themeTags, companionTags: spot.companionTags, active: spot.active, image: spot.image, revision: spot.revision } });
  expect(concurrent.status()).toBe(200);
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('他の画面で更新');
  await editor.getByRole('button', { name: '最新の保存内容を確認', exact: true }).click({ timeout: 3000 });
  await expect(editor.getByText('別画面での更新', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: '入力と写真を保持して編集を続ける', exact: true }).click();
  await expect(editor.getByLabel(/^紹介文/)).toHaveValue(localDescription);
  await expect(editor.getByAltText('スポット画像プレビュー')).toHaveAttribute('src', /^blob:/);
  await editor.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('スポットを保存しました');
});
