import { test, expect } from '@playwright/test';

test('相手別の招待・表示計測・所有者限定クーポンと一度限りの利用を確認する', async ({ page, browser, context }, info) => {
  const origin = process.env.E2E_BASE_URL!;
  const headers = { Origin: origin, 'X-Requested-With': 'kondo' };
  const admin = await browser.newContext({ viewport: page.viewportSize() });
  const guest = await browser.newContext({ viewport: page.viewportSize() });
  const other = await browser.newContext({ viewport: page.viewportSize() });
  try {
    await page.goto('/');
    await page.getByTestId('login-email').fill('demo@example.test');
    const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/login') && response.request().method() === 'POST');
    await page.getByTestId('login-submit').click();
    const login = await (await loginResponse).json();
    const settings = page.getByTestId('trip-settings-screen');
    if (login.brochure) { await expect(page.getByTestId('brochure')).toBeVisible(); await page.getByTestId('trip-settings-open').click(); }
    await expect(settings).toBeVisible();
    await settings.getByRole('checkbox').first().check();
    await settings.getByRole('radio', { name: 'パートナー', exact: true }).check();
    await settings.getByRole('button', { name: 'この内容で次の旅をつくる', exact: true }).click();
    await expect(page.getByTestId('brochure')).toBeVisible();
    const session = await (await page.request.get('/api/session')).json();
    const selected = session.brochure.items.find((item: { selected: boolean }) => item.selected);
    expect((await admin.request.post(origin + '/api/login', { headers, data: { email: 'town@example.test', code: '1111' } })).status()).toBe(200);
    const spot = (await (await admin.request.get(origin + '/api/admin/spots')).json()).spots.find((value: { id: string }) => value.id === selected.spotId);
    expect((await admin.request.put(origin + `/api/admin/spots/${spot.id}`, { headers, data: {
      name: spot.name, category: spot.category, description: spot.description, image: spot.image, themeTags: spot.themeTags,
      companionTags: spot.companionTags, active: true, hasGift: true, revision: spot.revision,
    } })).status()).toBe(200);
    await page.reload();
    await expect(page.locator('.brochure-header h1')).toContainText('ふたり');
    const card = page.locator('.category-card').filter({ has: page.getByRole('button', { name: spot.name + 'の詳細を表示', exact: true }) });
    await expect(card.locator('.gift-badge')).toContainText('クーポンあり');
    const badge = page.locator('.model-plan-list li').filter({ hasText: spot.name }).locator('.plan-coupon');
    expect(await badge.evaluate(node => getComputedStyle(node).justifySelf)).toBe('end');
    let claims = 0;
    page.on('request', request => { if (request.url().endsWith('/gift-claim') && request.method() === 'POST') claims++; });
    await card.getByRole('button', { name: spot.name + 'の詳細を表示', exact: true }).click();
    const detail = page.locator('.spot-detail-dialog');
    await detail.getByRole('button', { name: 'クーポンを表示する', exact: true }).click();
    const code = await detail.locator('.coupon-code-card code').innerText();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await expect(detail.getByRole('button', { name: 'キャンセル', exact: true })).toBeFocused();
    await page.screenshot({ path: info.outputPath('coupon-confirmation.png'), fullPage: true });
    await detail.getByRole('button', { name: 'キャンセル', exact: true }).click();
    expect(claims).toBe(0);
    await detail.getByRole('button', { name: 'クーポンを表示する', exact: true }).click();
    await expect(detail.locator('.coupon-code-card code')).toHaveText(code);
    await detail.getByRole('button', { name: 'キャンセル', exact: true }).click();
    await detail.getByRole('button', { name: 'スポット詳細を閉じる', exact: true }).click();

    const metadata = async () => (await (await page.request.get('/api/brochure/share')).json()).share;
    const before = (await metadata())?.viewCount ?? 0;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'しおりを見る', exact: true }).filter({ visible: true }).first().click();
    await expect(page.locator('.share-url-field')).toHaveCount(0);
    await page.getByRole('button', { name: 'パートナーを誘う', exact: true }).click();
    await expect(page.locator('.share-panel [role="status"]')).toHaveText('パートナーを誘うURLをコピーしました。');
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(url).origin).toBe(origin);
    expect(new URL(url).pathname).toMatch(/^\/share\/[a-f0-9]{64}$/);
    expect((await metadata()).viewCount).toBe(before);
    const guestPage = await guest.newPage();
    await guestPage.goto(url);
    await expect(guestPage.getByRole('heading', { name: /あなたに\s*旅の案内が届いてます/ })).toBeVisible();
    await expect(guestPage.getByTestId('brochure')).toHaveCount(0);
    expect((await metadata()).viewCount).toBe(before);
    await expect(guestPage.getByTestId('brochure')).toBeVisible();
    const heart = guestPage.getByRole('button', { name: spot.name + 'にいいね', exact: true });
    await expect(heart).toBeEnabled();
    const likeBefore = Number(await heart.innerText());
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(heart).toHaveText(String(likeBefore + 1));
    await expect(guestPage.locator('.spot-detail-dialog')).toHaveCount(0);
    await expect(guestPage.locator('.gift-badge')).toHaveCount(0);
    await guestPage.getByRole('button', { name: spot.name + 'の詳細を表示', exact: true }).click();
    await expect(guestPage.locator('.spot-detail-dialog')).toBeVisible();
    await expect(guestPage.getByRole('button', { name: 'クーポンを表示する', exact: true })).toHaveCount(0);
    await expect.poll(async () => (await metadata()).viewCount).toBe(before + 1);
    await guestPage.keyboard.press('Escape');
    await guestPage.screenshot({ path: info.outputPath('shared-anonymous.png'), fullPage: true });
    await guestPage.reload();
    await expect(guestPage.getByRole('button', { name: 'しおりを開く', exact: true })).toHaveCount(0);
    await expect(guestPage.getByTestId('brochure')).toBeVisible();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect(heart).toHaveText(String(likeBefore));
    await expect.poll(async () => (await metadata()).viewCount).toBe(before + 2);
    expect((await other.request.post(origin + '/api/login', { headers, data: { email: 'second@example.test', code: '1111' } })).status()).toBe(200);
    const otherPage = await other.newPage(); await otherPage.goto(url);
    await expect(otherPage.getByTestId('brochure')).toBeVisible();
    await expect(otherPage.locator('.gift-badge')).toHaveCount(0);

    await card.getByRole('button', { name: spot.name + 'の詳細を表示', exact: true }).click();
    await detail.getByRole('button', { name: 'クーポンを表示する', exact: true }).click();
    await page.route('**/api/spots/*/gift-claim', async route => {
      await route.fetch();
      await route.fulfill({ status: 503, json: { error: { code: 'lost_reply', message: '応答を受け取れませんでした。再試行してください。' } } });
    });
    await detail.getByRole('button', { name: 'クーポンを使う', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('再試行');
    await page.unroute('**/api/spots/*/gift-claim');
    await detail.getByRole('button', { name: 'クーポンを使う', exact: true }).click();
    await expect(detail.getByText('クーポン使用済み', { exact: true })).toBeVisible();
    expect(claims).toBe(2);
    expect((await (await admin.request.get(origin + `/api/admin/gift-claims?spotId=${spot.id}`)).json()).total).toBe(1);
    await detail.getByRole('button', { name: 'スポット詳細を閉じる', exact: true }).click();
    await page.reload();
    await card.getByRole('button', { name: spot.name + 'の詳細を表示', exact: true }).click();
    await expect(detail.getByText('クーポン使用済み', { exact: true })).toBeVisible();
    const adminPage = await admin.newPage(); await adminPage.goto(origin);
    await adminPage.getByRole('button', { name: '来訪履歴（クーポン利用）', exact: true }).click();
    await expect(adminPage.getByRole('table')).toContainText(spot.name);
    await adminPage.getByRole('button', { name: '共有状況', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: '公開URLアクセス数', exact: true })).toBeVisible();
    await adminPage.screenshot({ path: info.outputPath('admin-sharing.png'), fullPage: true });
  } finally { await Promise.all([admin.close(), guest.close(), other.close()]); }
});


test('公開案内と本文取得後の掲載変更をスマホ枠内でも回復できる', async ({ page, request }, info) => {
  const origin=process.env.E2E_BASE_URL!;
  const headers={Origin:origin,'X-Requested-With':'kondo'};
  expect((await request.post('/api/login',{headers,data:{email:'demo@example.test',code:'1111'}})).status()).toBe(200);
  expect((await request.post('/api/brochure/ensure',{headers,data:{}})).status()).toBe(200);
  const share=(await (await request.post('/api/brochure/share',{headers,data:{}})).json()).share;
  await page.route('**/api/shared/*/likes',route=>route.fulfill({json:{spots:[]}}));
  await page.goto(share.path+'?view=mobile');
  const frame=page.frameLocator('iframe.mobile-demo-app');
  await expect(frame.getByRole('heading',{name:/あなたに\s*旅の案内が届いてます/})).toBeVisible();
  await page.screenshot({path:info.outputPath('invitation-mobile-frame.png'),fullPage:true});
  await expect(frame.getByRole('button',{name:'しおりを開く',exact:true})).toHaveCount(0);
  await expect(frame.locator('.shared-invitation-card')).toHaveCount(0);
  await expect(frame.getByTestId('brochure')).toBeVisible();
  await expect(frame.getByRole('button',{name:'しおりを再読み込み'})).toHaveCount(5);
  await expect(frame.locator('.spot-like-button .spin')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('listing-changed-mobile-frame.png'),fullPage:true});
});
