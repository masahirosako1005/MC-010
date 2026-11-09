import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';
import { CATALOG, stableId } from '../src/server/catalog.js';
import type { Brochure, SavePayload, SessionData, TripSettings } from '../src/shared/types.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;
const mutationHeaders = {
  Origin: 'http://127.0.0.1:5173',
  'X-Requested-With': 'kondo',
};

interface ApiResponse<T> {
  response: Response;
  body: T;
}

databaseDescribe('PostgreSQL API integration', () => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  let admin: pg.Pool;
  let db: pg.Pool;
  let server: Server;
  let baseUrl: string;
  let uploadDir: string;

  async function api<T>(
    route: string,
    options: RequestInit & { cookie?: string } = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers(options.headers);
    if (options.cookie) headers.set('Cookie', options.cookie);
    const method = options.method?.toUpperCase() ?? 'GET';
    if (!['GET', 'HEAD'].includes(method)) {
      headers.set('Origin', mutationHeaders.Origin);
      headers.set('X-Requested-With', mutationHeaders['X-Requested-With']);
    }
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
    const body = await response.json() as T;
    return { response, body };
  }

  async function login(email = 'demo@example.test', code = '1111') {
    const result = await api<SessionData | { error: { code: string; message: string } }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    const cookie = result.response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    return { ...result, cookie };
  }

  async function ensure(cookie: string) {
    return api<{ brochure: Brochure }>('/api/brochure/ensure', {
      method: 'POST',
      cookie,
      body: '{}',
    });
  }

  const payload = (brochure: Brochure): SavePayload => ({
    revision: brochure.revision,
    companion: brochure.companion,
    duration: brochure.duration,
    tripStyle: brochure.tripStyle,
    template: brochure.template,
    items: brochure.items.map(({ id, selected, isMemory, order, comment }) => ({
      id, selected, isMemory, order, comment,
    })),
  });

  async function seedFixtures() {
    for (const [index, spot] of CATALOG.entries()) {
      await db.query(
        `INSERT INTO spots(id,external_id,name,category,description,companion_tags,theme_tags,image,source,source_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [spot.id, `sample-spot-${index + 1}`, spot.name, spot.category, spot.description,
          spot.companionTags, spot.themeTags, spot.image, spot.source, spot.sourceUrl],
      );
    }
    for (const [key, email, label] of [
      ['demo', 'demo@example.test', 'デモ利用者'],
      ['second', 'second@example.test', 'デモ利用者2'],
      ['empty', 'no-history@example.test', '履歴なしデモ利用者'],
    ] as const) {
      const userId = stableId(`fixture-user:${key}`);
      await db.query(
        `INSERT INTO users(id,external_id,email,display_name,source) VALUES($1,$2,$3,$4,'fixture')`,
        [userId, `fixture:${key}`, email, label],
      );
      if (key === 'empty') continue;
      const indices = key === 'demo' ? [0, 3] : [2, 4];
      for (const index of indices) {
        await db.query(
          `INSERT INTO visits(id,user_id,spot_id,visited_at,stamp,source_key)
           VALUES($1,$2,$3,'2026-05-03T10:00:00+09:00',true,$4)`,
          [stableId(`fixture-visit:${key}:${index}`), userId, CATALOG[index]!.id, `fixture:${key}:${index}`],
        );
      }
      await db.query(
        `INSERT INTO surveys(user_id,satisfaction,good_points,tags,previous_companion)
         VALUES($1,5,$2,$3,'友人')`,
        [userId, key === 'demo' ? '景色と散歩を楽しめた' : '文化体験が楽しかった',
          key === 'demo' ? ['海', '散歩', '食'] : ['文化', '体験']],
      );
    }
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new pg.Pool({
      connectionString: testDatabaseUrl,
      max: 4,
      options: `-c search_path=${schema}`,
    });
    await db.query(await readFile(path.resolve('db/migrations/001_initial.sql'), 'utf8'));
    uploadDir = await mkdtemp(path.join(tmpdir(), 'kondo-api-'));
    server = createApp(db, uploadDir).listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await db.query(
      'TRUNCATE item_photos, brochure_items, brochures, sessions, surveys, visits, auth_aliases, users, spots CASCADE',
    );
    await seedFixtures();
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (db) await db.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  });

  it('不正コード、幅の異なるコード、存在しない利用者を拒否しセッションを発行しない', async () => {
    for (const code of ['0000', '１１１１']) {
      const result = await login('demo@example.test', code);
      expect(result.response.status).toBe(code === '0000' ? 401 : 400);
      expect(result.response.headers.get('set-cookie')).toBeNull();
    }
    const missing = await login('missing@example.test');
    expect(missing.response.status).toBe(404);
    expect(missing.response.headers.get('set-cookie')).toBeNull();
  });

  it('mutationはOriginとカスタムヘッダーがなければ拒否する', async () => {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@example.test', code: '1111' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'origin_rejected' } });
  });

  it('履歴なし利用者ではパンフレットを作らず、履歴を捏造しない', async () => {
    const session = await login('no-history@example.test');
    expect(session.response.status).toBe(200);
    expect((session.body as SessionData).visits).toHaveLength(0);

    const result = await ensure(session.cookie);
    expect(result.response.status).toBe(422);
    const count = await db.query('SELECT count(*)::int AS count FROM brochures');
    expect(count.rows[0].count).toBe(0);
  });

  it('初回だけ生成し、ensure再送と再ログインで重複・上書きしない', async () => {
    const session = await login();
    const [first,second] = await Promise.all([ensure(session.cookie),ensure(session.cookie)]);

    expect(first.response.status).toBe(200);
    expect(second.body.brochure.id).toBe(first.body.brochure.id);
    expect(second.body.brochure.revision).toBe(first.body.brochure.revision);
    const count = await db.query('SELECT count(*)::int AS count FROM brochures');
    expect(count.rows[0].count).toBe(1);

    const again = await login();
    expect((again.body as SessionData).brochure?.id).toBe(first.body.brochure.id);
  });

  it('コメント・テンプレート・順序を保存してsession APIから復元する', async () => {
    const session = await login();
    const generated = (await ensure(session.cookie)).body.brochure;
    const draft = payload(generated);
    draft.template = 'postcard';
    draft.items[0]!.comment = '前回の景色をもう一度見たい😀';
    const selected = draft.items.filter((item) => item.selected).reverse();
    selected.forEach((item, order) => { item.order = order; });

    const saved = await api<{ brochure: Brochure }>('/api/brochure', {
      method: 'PUT', cookie: session.cookie, body: JSON.stringify(draft),
    });
    expect(saved.response.status).toBe(200);
    expect(saved.body.brochure.template).toBe('postcard');
    expect(saved.body.brochure.items.find((item) => item.id === draft.items[0]!.id)?.comment)
      .toBe('前回の景色をもう一度見たい😀');

    const restored = await api<SessionData>('/api/session', { cookie: session.cookie });
    expect(restored.body.brochure).toEqual(saved.body.brochure);
  });

  it('再生成しても全スポットのコメントとテンプレートを保持し、一人用紹介文を生成する', async () => {
    const session = await login();
    const data = session.body as SessionData;
    const generated = (await ensure(session.cookie)).body.brochure;
    const draft = payload(generated);
    draft.template = 'postcard';
    draft.items.forEach((item, index) => { item.comment = `保持コメント${index}`; });
    const settings: TripSettings = {
      companion: '一人',
      duration: 'overnight',
      tripStyle: 'active',
      visitedSpotIds: [data.visits[0]!.spotId],
    };

    const regenerated = await api<{ brochure: Brochure }>('/api/brochure/regenerate', {
      method: 'POST',
      cookie: session.cookie,
      body: JSON.stringify({ draft, settings, mode: 'all' }),
    });

    expect(regenerated.response.status).toBe(200);
    expect(regenerated.body.brochure.template).toBe('postcard');
    expect(regenerated.body.brochure.items.map((item) => item.comment))
      .toEqual(expect.arrayContaining(draft.items.map((item) => item.comment)));
    expect(regenerated.body.brochure.title).toContain('自分のペース');
    expect(regenerated.body.brochure.invitation).not.toContain('一緒に行かない？');
  });

  it('別利用者は他人のitemへ写真追加できず、所有者の写真も取得できない', async () => {
    const owner = await login();
    const ownerBrochure = (await ensure(owner.cookie)).body.brochure;
    const itemId = ownerBrochure.items[0]!.id;
    const second = await login('second@example.test');
    await ensure(second.cookie);

    const missingPhoto = new FormData();
    const foreignUpload = await api<{ error: { code: string } }>(`/api/items/${itemId}/photo`, {
      method: 'POST', cookie: second.cookie, body: missingPhoto,
    });
    expect(foreignUpload.response.status).toBe(404);

    const png = await sharp({create:{width:8,height:8,channels:3,background:'#ffcc33'}}).png().toBuffer();
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), 'memory.png');
    const uploaded = await api<{ photoUrl: string }>(`/api/items/${itemId}/photo`, {
      method: 'POST', cookie: owner.cookie, body: form,
    });
    expect(uploaded.response.status).toBe(200);
    const ownerPhoto = await fetch(`${baseUrl}${uploaded.body.photoUrl}`, { headers: { Cookie: owner.cookie } });
    expect(ownerPhoto.status).toBe(200);
    expect(ownerPhoto.headers.get('content-type')).toContain('image/webp');
    const foreignPhoto = await fetch(`${baseUrl}${uploaded.body.photoUrl}`, { headers: { Cookie: second.cookie } });
    expect(foreignPhoto.status).toBe(404);
  });

  it('revision競合と別利用者のitem混入を拒否し、保存内容を変更しない', async()=>{
    const owner=await login();
    const initial=(await ensure(owner.cookie)).body.brochure;
    const draft=payload(initial);
    draft.items[0]!.comment='確定したコメント';
    const first=await api<{brochure:Brochure}>('/api/brochure',{method:'PUT',cookie:owner.cookie,body:JSON.stringify(draft)});
    expect(first.response.status).toBe(200);
    const conflict=await api('/api/brochure',{method:'PUT',cookie:owner.cookie,body:JSON.stringify(draft)});
    expect(conflict.response.status).toBe(409);
    const second=await login('second@example.test');
    const other=(await ensure(second.cookie)).body.brochure;
    const mixed=payload(other);mixed.items[0]!.id=initial.items[0]!.id;
    expect((await api('/api/brochure',{method:'PUT',cookie:second.cookie,body:JSON.stringify(mixed)})).response.status).toBe(400);
    const restored=await api<SessionData>('/api/session',{cookie:owner.cookie});
    expect(restored.body.brochure!.items.find(i=>i.id===draft.items[0]!.id)!.comment).toBe('確定したコメント');
  });

  it('偽装MIME・SVG・巨大ファイル・巨大寸法を拒否し、通常画像の差替/削除を復元する',async()=>{
    const owner=await login();const brochure=(await ensure(owner.cookie)).body.brochure;
    const item=brochure.items[0]!;
    async function upload(bytes:Uint8Array,mime:string,name='../../outside.png'){
      const form=new FormData();form.append('photo',new Blob([new Uint8Array(bytes)],{type:mime}),name);
      return api<{photoUrl:string}>(`/api/items/${item.id}/photo`,{method:'POST',cookie:owner.cookie,body:form});
    }
    const good=await sharp({create:{width:8,height:8,channels:3,background:'#ff6677'}}).png().toBuffer();
    expect((await upload(Buffer.from('<svg><script>alert(1)</script></svg>'),'image/svg+xml')).response.status).toBe(415);
    expect((await upload(good,'image/jpeg')).response.status).toBe(415);
    expect((await upload(new Uint8Array(5*1024*1024+1),'image/png')).response.status).toBe(413);
    const tall=await sharp({create:{width:1,height:6001,channels:3,background:'#ff6677'}}).png().toBuffer();
    expect((await upload(tall,'image/png')).response.status).toBe(415);
    const added=await upload(good,'image/png');expect(added.response.status).toBe(200);
    const replaced=await upload(good,'image/png');expect(replaced.response.status).toBe(200);
    expect(replaced.body.photoUrl).not.toBe(added.body.photoUrl);
    expect((await fetch(`${baseUrl}${added.body.photoUrl}`,{headers:{Cookie:owner.cookie}})).status).toBe(404);
    const stored=await db.query('SELECT storage_key FROM item_photos WHERE item_id=$1',[item.id]);
    expect(stored.rows[0].storage_key).toMatch(/^[a-f0-9-]{36}\.webp$/);
    expect((await api(`/api/items/${item.id}/photo`,{method:'DELETE',cookie:owner.cookie})).response.status).toBe(200);
    const restored=await api<SessionData>('/api/session',{cookie:owner.cookie});
    expect(restored.body.brochure!.items.find(i=>i.id===item.id)!.photoUrl).toBeNull();
  });

  it('XSS文字列はデータとして保存され、API応答にもセキュリティヘッダーを付ける', async () => {
    const session = await login();
    const generated = (await ensure(session.cookie)).body.brochure;
    const draft = payload(generated);
    draft.items[0]!.comment = '<img src=x onerror=alert(1)>';

    const saved = await api<{ brochure: Brochure }>('/api/brochure', {
      method: 'PUT', cookie: session.cookie, body: JSON.stringify(draft),
    });

    expect(saved.response.status).toBe(200);
    expect(saved.body.brochure.items[0]!.comment).toBe('<img src=x onerror=alert(1)>');
    expect(saved.response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(saved.response.headers.get('content-security-policy')).toContain("object-src 'none'");
    expect(saved.response.headers.get('cache-control')).toBe('no-store');
  });
});
