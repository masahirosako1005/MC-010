import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const audioDir = join(root, 'demo-audio');
const origin = 'http://127.0.0.1:3001';
function command(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`音声処理に失敗しました (${code})`)));
  });
}
const powershell = 'powershell.exe';
await command(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/voice-demo-audio.ps1'), '-OutputDirectory', audioDir]);
async function say(name, target) {
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate(element => element.scrollIntoView({block: 'center', behavior: 'instant'}));
    await target.evaluate(element => element.animate([
      {outline: '4px solid #e89a28', outlineOffset: '5px'},
      {outline: '4px solid transparent', outlineOffset: '5px'}
    ], {duration: 1800}));
  }
  await command(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts/voice-demo-play.ps1'), '-Path', join(audioDir, `${name}.wav`)]);
}
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(20000);
try {
  await page.goto(`${origin}/demo/rally`);
  await page.getByRole('link', { name: /旅のしおりを/ }).waitFor();
  await say('intro', page.getByRole('link', {name: /旅のしおりを/}));
  await page.getByRole('link', { name: /旅のしおりを/ }).click();
  const app = page.frameLocator('iframe.mobile-demo-app');
  await app.getByTestId('login-email').waitFor();
  await say('login', app.getByTestId('login-email'));
  await app.getByTestId('login-email').fill('demo@example.test');
  await app.getByLabel('認証コード').fill('1111');
  await app.getByTestId('login-submit').click();
  const settings = app.getByTestId('trip-settings-screen');
  const brochure = app.getByTestId('brochure');
  await Promise.race([settings.waitFor(), brochure.waitFor()]);
  if (await settings.isVisible()) {
    await settings.getByRole('checkbox').first().check();
    await settings.getByRole('radio', { name: '友人', exact: true }).check();
    await settings.getByRole('radio', { name: '日帰り', exact: true }).check();
    await settings.getByRole('radio', { name: 'ゆっくり', exact: true }).check();
    await say('settings', settings.getByRole('radio', {name: '友人', exact: true}));
    await settings.getByRole('button', { name: 'この内容で次の旅をつくる', exact: true }).click();
    await brochure.waitFor();
    await say('created', app.getByRole('heading', {name: '5つの楽しみ', exact: true}));
  } else {
    await say('saved', app.getByRole('heading', {name: '5つの楽しみ', exact: true}));
  }
  await app.getByRole('button', { name: 'しおりを見る', exact: true }).filter({ visible: true }).first().click();
  await app.getByText('作成者としての表示').waitFor();
  await say('view', app.getByRole('heading', {name: 'この旅に誘う', exact: true}));
  const memory = app.getByRole('button', { name: '月花の風車丘', exact: true }).first();
  await memory.click();
  const dialog = app.locator('.spot-detail-dialog');
  await dialog.waitFor();
  if (await dialog.getByRole('button', { name: 'クーポンを表示する' }).isVisible()) {
    await say('coupon', dialog.getByRole('button', {name: 'クーポンを表示する'}));
    await dialog.getByRole('button', { name: 'クーポンを表示する' }).click();
    await dialog.getByRole('button', { name: 'クーポンを使う', exact: true }).click();
    await dialog.getByText('クーポン使用済み', { exact: true }).waitFor();
    await say('coupon_used', dialog.getByText('クーポン使用済み', {exact: true}));
  } else if (await dialog.getByText('クーポン使用済み', { exact: true }).isVisible()) {
    await say('coupon_already', dialog.getByText('クーポン使用済み', {exact: true}));
  }
  await dialog.getByRole('button', { name: 'スポット詳細を閉じる' }).click();
  const invite = app.getByRole('button', { name: /を誘う|しおりを共有する/ });
  await invite.click();
  await app.locator('.share-panel [role="status"]').waitFor();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  if (new URL(shareUrl).origin !== origin) throw new Error('共有URLを確認できませんでした。');
  await say('shared', invite);
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(shareUrl);
  const guestApp = shareUrl.includes('view=mobile') ? guestPage.frameLocator('iframe.mobile-demo-app') : guestPage;
  await guestApp.getByTestId('brochure').waitFor({ timeout: 20000 });
  await guestPage.bringToFront();
  await say('guest', guestApp.getByRole('heading', {name: '旅の全体像', exact: true}));
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await adminPage.goto(origin);
  await adminPage.getByTestId('login-email').fill('town@example.test');
  await adminPage.getByLabel('認証コード').fill('1111');
  await adminPage.getByTestId('login-submit').click();
  await adminPage.getByRole('heading', { name: '概況', exact: true }).waitFor();
  await say('admin', adminPage.getByRole('heading', {name: '体験カテゴリ別の採用', exact: true}));
  await adminPage.getByRole('button', { name: '共有状況', exact: true }).click();
  await adminPage.getByRole('heading', { name: '公開URLアクセス数', exact: true }).waitFor();
  await say('sharing', adminPage.getByRole('heading', {name: '公開URLアクセス数', exact: true}));
  await adminPage.getByRole('button', { name: '来訪履歴（クーポン利用）', exact: true }).click();
  await adminPage.getByRole('heading', { name: 'クーポン利用件数', exact: true }).waitFor();
  await say('claims', adminPage.getByRole('heading', {name: 'クーポン利用件数', exact: true}));
  console.log('デモが終了しました。ブラウザを閉じるとスクリプトが終了します。');
  await new Promise(resolve => browser.on('disconnected', resolve));
} catch (error) {
  console.error('デモを中断しました:', error.message);
  await browser.close();
  process.exitCode = 1;
}
