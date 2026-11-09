import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';
import { CATALOG, stableId } from '../src/server/catalog.js';
import type { Brochure, SavePayload, SessionData, TripSettings } from '../src/shared/types.js';
import type { AdminOverview, AdminSpot, RegistrationPage, SpotInput } from '../src/shared/admin-types.js';

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
    items: brochure.items.map(({ id, selected, isMemory, order, comment, pickupCategory }) => ({
      id, selected, isMemory, order, comment, pickupCategory,
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
    await db.query(`INSERT INTO users(id,external_id,email,display_name,source,account_role)
      VALUES($1,'fixture:town-admin','town@example.test','町管理者','fixture','town_admin')`, [stableId('fixture-user:town-admin')]);
  }

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    db = new pg.Pool({
      connectionString: testDatabaseUrl,
      max: 4,
      options: `-c search_path=${schema}`,
    });
    for (const file of (await readdir(path.resolve('db/migrations'))).filter(file => file.endsWith('.sql')).sort()) {
      await db.query(await readFile(path.resolve('db/migrations', file), 'utf8'));
    }
    uploadDir = await mkdtemp(path.join(tmpdir(), 'kondo-api-'));
  });

  beforeEach(async () => {
    await db.query(
      'TRUNCATE item_photos, brochure_items, brochures, sessions, surveys, visits, auth_aliases, users, spots CASCADE',
    );
    await seedFixtures();
    server = createApp(db, uploadDir).listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
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

  it('初回の確定条件を反映し、空・重複・未訪問の再訪IDを拒否して既存冊子を上書きしない', async()=>{
    const owner=await login();
    const data=owner.body as SessionData;
    const chosen=data.visits.at(-1)!.spotId;
    const unvisited=CATALOG.find(spot=>!data.visits.some(visit=>visit.spotId===spot.id))!.id;
    const settings:TripSettings={companion:'家族',duration:'overnight',tripStyle:'active',visitedSpotIds:[chosen]};
    for(const visitedSpotIds of [[],[chosen,chosen],[unvisited]]){
      const rejected=await api('/api/brochure/ensure',{method:'POST',cookie:owner.cookie,body:JSON.stringify({settings:{...settings,visitedSpotIds}})});
      expect(rejected.response.status).toBe(400);
      expect((await db.query('SELECT count(*)::int AS count FROM brochures')).rows[0].count).toBe(0);
    }
    const created=await api<{brochure:Brochure}>('/api/brochure/ensure',{method:'POST',cookie:owner.cookie,body:JSON.stringify({settings})});
    expect(created.response.status).toBe(200);
    expect(created.body.brochure).toMatchObject({companion:'家族',duration:'overnight',tripStyle:'active',template:'colorful'});
    expect(created.body.brochure.items.filter(item=>item.isMemory).map(item=>item.spotId)).toEqual([chosen]);
    expect(created.body.brochure.items.filter(item=>item.selected&&item.kind==='visited').every(item=>item.spotId===chosen)).toBe(true);
    const repeated=await api<{brochure:Brochure}>('/api/brochure/ensure',{method:'POST',cookie:owner.cookie,body:JSON.stringify({settings:{...settings,companion:'一人',duration:'day'}})});
    expect(repeated.response.status).toBe(200);
    expect(repeated.body.brochure).toEqual(created.body.brochure);
    expect((await db.query('SELECT count(*)::int AS count FROM brochures')).rows[0].count).toBe(1);
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

  const spotInput = (spot?: AdminSpot): SpotInput => ({
    name: spot?.name ?? '検証用スポット', category: spot?.category ?? '景色',
    description: spot?.description ?? '検証用の紹介文', image: spot?.image ?? '/assets/lake.png',
    themeTags: spot?.themeTags ?? ['景色'], companionTags: (spot?.companionTags ?? ['友人']) as SpotInput['companionTags'], active: spot?.active ?? true,
  });
  async function adminSpots(cookie: string) { return (await api<{ spots: AdminSpot[] }>('/api/admin/spots', { cookie })).body.spots; }
  async function editSpot(cookie: string, spot: AdminSpot, changes: Partial<SpotInput> = {}) {
    return api<{ spot: AdminSpot }>(`/api/admin/spots/${spot.id}`, { method: 'PUT', cookie, body: JSON.stringify({ ...spotInput(spot), ...changes, revision: spot.revision }) });
  }

  it('町権限を出所と分離し、未認証・利用者・町側の境界と権限失効を強制する', async () => {
    expect((await api('/api/admin/overview')).response.status).toBe(401);
    const owner = await login();
    await db.query("UPDATE users SET source='organizer' WHERE email='demo@example.test'");
    expect((await api('/api/admin/spots', { cookie: owner.cookie })).response.status).toBe(403);
    const town = await login('town@example.test');
    expect(town.response.status).toBe(200);
    expect(town.body).toMatchObject({ user: { role: 'town_admin' }, visits: [], spots: [], brochure: null });
    expect((await api('/api/admin/overview', { cookie: town.cookie })).response.status).toBe(200);
    expect((await ensure(town.cookie)).response.status).toBe(403);
    const noCsrf = await fetch(`${baseUrl}/api/admin/spots`, { method: 'POST', headers: { Cookie: town.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(spotInput()) });
    expect(noCsrf.status).toBe(403);
    await db.query("UPDATE users SET account_role='visitor' WHERE email='town@example.test'");
    expect((await api('/api/admin/overview', { cookie: town.cookie })).response.status).toBe(403);
  });

  it('スポットを追加・編集・公開停止・再開し、revisionと監査記録を維持する', async () => {
    const town = await login('town@example.test');
    const created = await api<{ spot: AdminSpot }>('/api/admin/spots', { method: 'POST', cookie: town.cookie, body: JSON.stringify(spotInput()) });
    expect(created.response.status).toBe(201);
    expect(created.body.spot).toMatchObject({ source: 'town', active: true, revision: 1, visitCount: 0 });
    const stopped = await editSpot(town.cookie, created.body.spot, { name: '<script>データとして表示</script>', active: false });
    expect(stopped.response.status).toBe(200);
    expect(stopped.body.spot).toMatchObject({ active: false, revision: 2 });
    expect((await editSpot(town.cookie, created.body.spot)).response.status).toBe(409);
    const reopened = await editSpot(town.cookie, stopped.body.spot, { active: true });
    expect(reopened.body.spot.revision).toBe(3);
    const audit = await db.query('SELECT action FROM admin_audit_logs WHERE spot_id=$1 ORDER BY created_at', [created.body.spot.id]);
    expect(audit.rows.map(row => row.action)).toEqual(['create', 'update_stopped', 'update']);
    for (const invalid of [{ image: '../../outside.png' }, { themeTags: [] }, { name: ' ' }, { account_role: 'town_admin' }]) {
      expect((await api('/api/admin/spots', { method: 'POST', cookie: town.cookie, body: JSON.stringify({ ...spotInput(), ...invalid }) })).response.status).toBe(400);
    }
  });

  it('匿名の登録一覧と集計は町側を母数から除き、出所・作成・履歴・ページを正しく絞る', async () => {
    const owner = await login(); const brochure = (await ensure(owner.cookie)).body.brochure;
    const draft = payload(brochure); draft.items.find(item => item.selected)!.comment = '一覧に本文を出さない';
    expect((await api('/api/brochure', { method: 'PUT', cookie: owner.cookie, body: JSON.stringify(draft) })).response.status).toBe(200);
    await db.query("UPDATE users SET source='organizer' WHERE email='second@example.test'");
    const town = await login('town@example.test');
    const summary = await api<AdminOverview>('/api/admin/overview', { cookie: town.cookie });
    expect(summary.response.status).toBe(200);
    expect(summary.body).toMatchObject({ users: 3, usersWithVisits: 2, brochures: 1, eligibleBrochures: 1, activeSpots: 7, stoppedSpots: 0 });
    expect(summary.body.categories.reduce((n, row) => n + row.count, 0)).toBe(brochure.items.filter(item => item.selected).length);
    const list = await api<RegistrationPage>('/api/admin/registrations?status=created&history=yes&scope=fixture', { cookie: town.cookie });
    expect(list.response.status).toBe(200); expect(list.body.total).toBe(1);
    expect(list.body.rows[0]).toMatchObject({ userId: (owner.body as SessionData).user.id, comments: 1 });
    expect(Object.keys(list.body.rows[0]!).sort()).toEqual(['userId', 'source', 'visits', 'brochureId', 'createdAt', 'updatedAt', 'selectedSpots', 'photos', 'comments'].sort());
    expect((await api<RegistrationPage>('/api/admin/registrations?scope=organizer&status=missing&history=yes', { cookie: town.cookie })).body.total).toBe(1);
    for (let i = 0; i < 30; i++) await db.query("INSERT INTO users(id,external_id,display_name,source) VALUES($1,$2,'検証用匿名利用者','fixture')", [randomUUID(), `pagination:${i}`]);
    const first = (await api<RegistrationPage>('/api/admin/registrations?page=1', { cookie: town.cookie })).body;
    const last = (await api<RegistrationPage>('/api/admin/registrations?page=999', { cookie: town.cookie })).body;
    expect(first.rows).toHaveLength(25); expect(last).toMatchObject({ total: 33, page: 2, pageSize: 25 }); expect(last.rows).toHaveLength(8);
    expect(new Set([...first.rows, ...last.rows].map(row => row.userId)).size).toBe(33);
    expect((await api('/api/admin/registrations?page=-1', { cookie: town.cookie })).response.status).toBe(400);
  });

  it('使用中タグ削除を拒否し、公開停止でも保存済み掲載と個人編集を保持する', async () => {
    const owner = await login(), brochure = (await ensure(owner.cookie)).body.brochure;
    const town = await login('town@example.test'), spots = await adminSpots(town.cookie);
    const selected = brochure.items.find(item => item.pickupCategory === 'see')!;
    const spot = spots.find(spot => spot.id === selected.spotId)!;
    const rejected = await editSpot(town.cookie, spot, { themeTags: ['食'] });
    expect(rejected.response.status).toBe(409);
    const stopped = await editSpot(town.cookie, spot, { active: false }); expect(stopped.response.status).toBe(200);
    const draft = payload(brochure); draft.items.find(item => item.id === selected.id)!.comment = '公開停止後も残す';
    expect((await api('/api/brochure', { method: 'PUT', cookie: owner.cookie, body: JSON.stringify(draft) })).response.status).toBe(200);
    const restored = (await api<SessionData>('/api/session', { cookie: owner.cookie })).body.brochure!;
    expect(restored.items.find(item => item.id === selected.id)).toMatchObject({ selected: true, comment: '公開停止後も残す' });
    const settings: TripSettings = { companion: '友人', duration: 'day', tripStyle: 'slow', visitedSpotIds: [(owner.body as SessionData).visits[0]!.spotId] };
    const regenerated = await api<{ brochure: Brochure }>('/api/brochure/regenerate', { method: 'POST', cookie: owner.cookie, body: JSON.stringify({ draft: payload(restored), settings, mode: 'all' }) });
    expect(regenerated.response.status).toBe(200);
    expect(regenerated.body.brochure.items.find(item => item.id === selected.id)).toMatchObject({ selected: false, comment: '公開停止後も残す' });
  });

  it('新スポットを再生成時に追加し、全既存itemのコメントと写真を保持する', async () => {
    const owner = await login(), brochure = (await ensure(owner.cookie)).body.brochure;
    const draft = payload(brochure); draft.items.forEach(item => item.comment = '保持する検証メモ');
    const form = new FormData(); form.append('photo', new Blob([await sharp({ create: { width: 8, height: 8, channels: 3, background: '#334455' } }).png().toBuffer()], { type: 'image/png' }), 'fixture.png');
    const uploaded = await api<{ photoUrl: string }>(`/api/items/${brochure.items[0]!.id}/photo`, { method: 'POST', cookie: owner.cookie, body: form });
    const town = await login('town@example.test');
    const created = await api<{ spot: AdminSpot }>('/api/admin/spots', { method: 'POST', cookie: town.cookie, body: JSON.stringify(spotInput()) });
    const settings: TripSettings = { companion: '友人', duration: 'day', tripStyle: 'slow', visitedSpotIds: [(owner.body as SessionData).visits[0]!.spotId] };
    const result = await api<{ brochure: Brochure; spots: AdminSpot[] }>('/api/brochure/regenerate', { method: 'POST', cookie: owner.cookie, body: JSON.stringify({ draft, settings, mode: 'all' }) });
    expect(result.response.status).toBe(200); expect(result.body.spots.some(spot => spot.id === created.body.spot.id)).toBe(true);
    expect(result.body.brochure.items).toHaveLength(brochure.items.length + 1);
    for (const item of brochure.items) expect(result.body.brochure.items.find(next => next.id === item.id)?.comment).toBe('保持する検証メモ');
    expect(result.body.brochure.items.find(item => item.id === brochure.items[0]!.id)?.photoUrl).toBe(uploaded.body.photoUrl);
  });

  it('町の公式画像は認証・revision・画像検証を要求し、個人写真を町側へ開放しない', async () => {
    const town = await login('town@example.test'), spot = (await adminSpots(town.cookie))[0]!;
    const owner = await login(), brochure = (await ensure(owner.cookie)).body.brochure;
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#889900' } }).png().toBuffer();
    const form = () => { const data = new FormData(); data.append('photo', new Blob([png], { type: 'image/png' }), '../../fixture.png'); return data; };
    const route = `/api/admin/spots/${spot.id}/photo`;
    expect((await api(route, { method: 'POST', cookie: owner.cookie, body: form(), headers: { 'If-Match': String(spot.revision) } })).response.status).toBe(403);
    expect((await api(route, { method: 'POST', cookie: town.cookie, body: form() })).response.status).toBe(400);
    const uploaded = await api<{ image: string; revision: number }>(route, { method: 'POST', cookie: town.cookie, body: form(), headers: { 'If-Match': String(spot.revision) } });
    expect(uploaded.response.status).toBe(200); expect(uploaded.body.revision).toBe(spot.revision + 1);
    expect((await fetch(baseUrl + uploaded.body.image)).status).toBe(401);
    const official = await fetch(baseUrl + uploaded.body.image, { headers: { Cookie: owner.cookie } });
    expect(official.status).toBe(200); expect(official.headers.get('content-type')).toContain('image/webp');
    expect((await api(route, { method: 'POST', cookie: town.cookie, body: form(), headers: { 'If-Match': String(spot.revision) } })).response.status).toBe(409);
    const privatePhoto = await api<{ photoUrl: string }>(`/api/items/${brochure.items[0]!.id}/photo`, { method: 'POST', cookie: owner.cookie, body: form() });
    expect((await fetch(baseUrl + privatePhoto.body.photoUrl, { headers: { Cookie: town.cookie } })).status).toBe(403);
  });

  it('個別候補変更は更新順にかかわらずカテゴリを一意に付け替えて保存できる', async () => {
    const owner = await login(), brochure = (await ensure(owner.cookie)).body.brochure;
    const draft = payload(brochure);
    const current = draft.items.find(item => item.pickupCategory === 'see')!;
    const replacement = draft.items.find(item => !item.selected && CATALOG.find(spot => spot.id === brochure.items.find(i => i.id === item.id)!.spotId)?.themeTags.includes('景色'))!;
    expect(replacement).toBeDefined();
    replacement.selected = true; replacement.pickupCategory = current.pickupCategory; replacement.order = current.order;
    current.selected = false; current.pickupCategory = null; current.comment = '外しても保持';
    draft.items = [replacement, ...draft.items.filter(item => item.id !== replacement.id)];
    const saved = await api<{ brochure: Brochure }>('/api/brochure', { method: 'PUT', cookie: owner.cookie, body: JSON.stringify(draft) });
    expect(saved.response.status).toBe(200);
    expect(saved.body.brochure.items.find(item => item.id === current.id)).toMatchObject({ selected: false, comment: '外しても保持', pickupCategory: null });
  });

  it('新規スポットの応答を受け取れなくても同じ操作IDの再送で重複登録しない', async () => {
    const town = await login('town@example.test'), requestId = randomUUID();
    const create = () => api<{ spot: AdminSpot }>('/api/admin/spots', { method: 'POST', cookie: town.cookie, body: JSON.stringify({ ...spotInput(), requestId }) });
    const [first, retry] = await Promise.all([create(), create()]);
    expect(first.response.status).toBe(201); expect(retry.response.status).toBe(201);
    expect(first.body.spot.id).toBe(retry.body.spot.id);
    expect((await adminSpots(town.cookie)).filter(spot => spot.id === requestId)).toHaveLength(1);
    expect((await db.query('SELECT count(*)::int AS count FROM admin_audit_logs WHERE spot_id=$1', [requestId])).rows[0].count).toBe(1);
  });

  async function giftFixture() {
    const owner = await login(), town = await login('town@example.test');
    const brochure = (await ensure(owner.cookie)).body.brochure;
    const spot = (await adminSpots(town.cookie)).find(spot => brochure.items.some(item => item.selected && item.spotId === spot.id))!;
    expect((await editSpot(town.cookie, spot, { hasGift: true })).response.status).toBe(200);
    return { owner, town, brochure, spot };
  }
  const post = <T>(route: string, cookie?: string, data: unknown = {}) =>
    api<T>(route, { method: 'POST', cookie, body: JSON.stringify(data) });
  async function pngForm() {
    const bytes = await sharp({ create: { width: 20, height: 15, channels: 3, background: '#e0a060' } }).png().toBuffer();
    const form = new FormData(); form.append('photo', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'fixture.png'); return form;
  }

  it('クーポンは本人の冊子に限定し、表示とキャンセルでは利用を記録しない', async () => {
    const { owner, town, spot } = await giftFixture(), other = await login('second@example.test');
    const endpoint = `/api/spots/${spot.id}`;
    expect((await api(endpoint + '/detail')).response.status).toBe(401);
    expect((await api(endpoint + '/detail', { cookie: other.cookie })).response.status).toBe(404);
    expect((await post(endpoint + '/coupon', town.cookie)).response.status).toBe(403);
    expect((await post(endpoint + '/gift-claim', owner.cookie)).response.status).toBe(409);
    const details = await api<{ giftClaim: unknown }>(endpoint + '/detail', { cookie: owner.cookie });
    expect(details.body.giftClaim).toBeNull();
    const issued = await Promise.all(Array.from({ length: 6 }, () => post<{ couponCode: string }>(endpoint + '/coupon', owner.cookie)));
    expect(issued.every(result => result.response.status === 200)).toBe(true);
    expect(issued[0]!.body.couponCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(new Set(issued.map(result => result.body.couponCode)).size).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM spot_coupon_codes')).rows[0].n).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM spot_gift_claims')).rows[0].n).toBe(0);
    expect((await post(endpoint + '/gift-claim', owner.cookie, { userId: (other.body as SessionData).user.id })).response.status).toBe(400);
  });

  it('利用を並列・再送しても1件にし、別利用者の利用を混在させない', async () => {
    const { owner, town, spot } = await giftFixture(), other = await login('second@example.test');
    await ensure(other.cookie);
    const endpoint = `/api/spots/${spot.id}`;
    const a = await post<{ couponCode: string }>(endpoint + '/coupon', owner.cookie);
    const b = await post<{ couponCode: string }>(endpoint + '/coupon', other.cookie);
    expect(a.body.couponCode).not.toBe(b.body.couponCode);
    const results = await Promise.all(Array.from({ length: 8 }, () => post<{ giftClaim: { id: string } }>(endpoint + '/gift-claim', owner.cookie)));
    expect(results.every(result => result.response.status === 200)).toBe(true);
    expect(new Set(results.map(result => result.body.giftClaim.id)).size).toBe(1);
    expect((await api<{ giftClaim: unknown }>(endpoint + '/detail', { cookie: other.cookie })).body.giftClaim).toBeNull();
    const current = (await adminSpots(town.cookie)).find(value => value.id === spot.id)!;
    expect(current.giftClaimCount).toBe(1);
    await editSpot(town.cookie, current, { active: false, hasGift: false });
    expect((await post(endpoint + '/gift-claim', owner.cookie)).response.status).toBe(200);
    expect((await post(endpoint + '/gift-claim', other.cookie)).response.status).toBe(409);
    expect((await post<{ couponCode: unknown }>(endpoint + '/coupon', owner.cookie)).body.couponCode).toBeNull();
    expect((await db.query('SELECT count(*)::int AS n FROM spot_gift_claims')).rows[0].n).toBe(1);
  });

  it('利用履歴は町だけが匿名で参照でき、出所/スポットで絞れる', async () => {
    const { owner, town, spot } = await giftFixture();
    await post(`/api/spots/${spot.id}/coupon`, owner.cookie);
    await post(`/api/spots/${spot.id}/gift-claim`, owner.cookie);
    expect((await api('/api/admin/gift-claims')).response.status).toBe(401);
    expect((await api('/api/admin/gift-claims', { cookie: owner.cookie })).response.status).toBe(403);
    const history = await api<{ total: number; users: number; page: number; rows: Record<string, unknown>[] }>(`/api/admin/gift-claims?scope=fixture&spotId=${spot.id}&page=99`, { cookie: town.cookie });
    expect(history.body).toMatchObject({ total: 1, users: 1, page: 1 });
    expect(Object.keys(history.body.rows[0]!).sort()).toEqual(['id', 'spotId', 'claimedAt', 'userId', 'source', 'spotName'].sort());
    expect((await api<{ total: number }>('/api/admin/gift-claims?scope=organizer', { cookie: town.cookie })).body.total).toBe(0);
    expect((await api('/api/admin/gift-claims?spotId=bad', { cookie: town.cookie })).response.status).toBe(400);
  });

  it('共有URLは本人が発行し、並列要求でも同じURLと件数を返す', async () => {
    const owner = await login(), town = await login('town@example.test');
    expect((await post('/api/brochure/share')).response.status).toBe(401);
    expect((await post('/api/brochure/share', town.cookie)).response.status).toBe(403);
    expect((await post('/api/brochure/share', owner.cookie)).response.status).toBe(404);
    await ensure(owner.cookie);
    const shares = await Promise.all(Array.from({ length: 6 }, () => post<{ share: { path: string; viewCount: number } }>('/api/brochure/share', owner.cookie)));
    expect(shares.every(result => result.response.status === 200)).toBe(true);
    expect(shares[0]!.body.share.path).toMatch(/^\/share\/[a-f0-9]{64}$/);
    expect(new Set(shares.map(result => result.body.share.path)).size).toBe(1);
    expect(shares[0]!.body.share.viewCount).toBe(0);
    expect((await post('/api/brochure/share', owner.cookie, { userId: randomUUID() })).response.status).toBe(400);
  });

  it('公開本文は掲載/思い出だけに絞り、作成者以外へクーポンや私的情報を返さない', async () => {
    const { owner, town, brochure, spot } = await giftFixture(), other = await login('second@example.test');
    await ensure(other.cookie);
    const hidden = brochure.items.find(item => !item.selected && !item.isMemory)!;
    await db.query('UPDATE brochure_items SET comment=$1 WHERE id=$2', ['PRIVATE_UNPUBLISHED_NOTE', hidden.id]);
    const shared = await post<{ share: { path: string } }>('/api/brochure/share', owner.cookie);
    const endpoint = '/api/shared/' + shared.body.share.path.split('/').at(-1);
    for (const cookie of [undefined, other.cookie, town.cookie]) {
      const result = await api<import('../src/shared/sharing-types.js').SharedBrochure>(endpoint, { cookie });
      expect(result.response.status).toBe(200);
      expect(result.body.viewerIsOwner).toBe(false);
      expect(result.body.spots.every(value => value.hasGift === false)).toBe(true);
      expect(result.body.brochure.items.every(item => item.selected || (item.kind === 'visited' && item.isMemory))).toBe(true);
      expect(result.body.brochure.items.some(item => item.id === hidden.id)).toBe(false);
      expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE_UNPUBLISHED_NOTE|goodPoints|couponCode|giftClaim|displayName|email/);
      expect(Object.keys(result.body).sort()).toEqual(['brochure', 'spots', 'memoryVisits', 'viewerIsOwner'].sort());
    }
    const self = await api<import('../src/shared/sharing-types.js').SharedBrochure>(endpoint, { cookie: owner.cookie });
    expect(self.body.viewerIsOwner).toBe(true);
    expect(self.body.spots.find(value => value.id === spot.id)?.hasGift).toBe(true);
    expect((await api(endpoint)).response.headers.get('cache-control')).toBe('no-store');
  });

  it('共有写真は公開URLと掲載範囲を照合し、非掲載写真を拒否する', async () => {
    const { owner, town, brochure, spot } = await giftFixture();
    const visible = brochure.items.find(item => item.spotId === spot.id)!;
    const hidden = brochure.items.find(item => !item.selected && !item.isMemory)!;
    const visiblePhoto = await api<{ photoUrl: string }>(`/api/items/${visible.id}/photo`, { method: 'POST', cookie: owner.cookie, body: await pngForm() });
    const hiddenPhoto = await api<{ photoUrl: string }>(`/api/items/${hidden.id}/photo`, { method: 'POST', cookie: owner.cookie, body: await pngForm() });
    const current = (await adminSpots(town.cookie)).find(value => value.id === spot.id)!;
    expect((await api(`/api/admin/spots/${spot.id}/photo`, { method: 'POST', cookie: town.cookie, headers: { 'If-Match': String(current.revision) }, body: await pngForm() })).response.status).toBe(200);
    const shared = await post<{ share: { path: string } }>('/api/brochure/share', owner.cookie);
    const base = '/api/shared/' + shared.body.share.path.split('/').at(-1);
    const body = (await api<import('../src/shared/sharing-types.js').SharedBrochure>(base)).body;
    const publicPhoto = body.brochure.items.find(item => item.id === visible.id)!.photoUrl!;
    expect((await fetch(baseUrl + publicPhoto)).status).toBe(200);
    expect((await fetch(baseUrl + visiblePhoto.body.photoUrl)).status).toBe(401);
    expect((await fetch(baseUrl + base + '/photos/' + hiddenPhoto.body.photoUrl.split('/').at(-1))).status).toBe(404);
    expect((await fetch(baseUrl + body.spots.find(value => value.id === spot.id)!.image)).status).toBe(200);
    expect((await fetch(baseUrl + '/api/shared/' + '0'.repeat(64) + '/photos/' + visiblePhoto.body.photoUrl.split('/').at(-1))).status).toBe(404);
  });

  it('共有表示をUUIDで一度だけ記録し、公開停止/再開でURLと件数を保持する', async () => {
    const owner = await login(); await ensure(owner.cookie);
    const share = (await post<{ share: { path: string } }>('/api/brochure/share', owner.cookie)).body.share;
    const endpoint = '/api/shared/' + share.path.split('/').at(-1);
    await api(endpoint); await fetch(baseUrl + endpoint, { method: 'HEAD' });
    const metadata = () => api<{ share: { path: string; viewCount: number; active: boolean; lastViewedAt: string | null } }>('/api/brochure/share', { cookie: owner.cookie });
    expect((await metadata()).body.share.viewCount).toBe(0);
    const requestId = randomUUID();
    const views = await Promise.all(Array.from({ length: 8 }, () => post(endpoint + '/views', undefined, { requestId })));
    expect(views.every(value => value.response.status === 200)).toBe(true);
    expect((await metadata()).body.share.viewCount).toBe(1);
    await post(endpoint + '/views', undefined, { requestId: randomUUID() });
    expect((await metadata()).body.share.viewCount).toBe(2);
    expect((await metadata()).body.share.lastViewedAt).not.toBeNull();
    expect((await post(endpoint + '/views', undefined, { requestId, userId: randomUUID() })).response.status).toBe(400);
    expect((await api('/api/brochure/share', { method: 'DELETE', cookie: owner.cookie, body: '{}' })).response.status).toBe(200);
    expect((await api(endpoint)).response.status).toBe(404);
    expect((await post(endpoint + '/views', undefined, { requestId: randomUUID() })).response.status).toBe(404);
    const resumed = (await post<{ share: { path: string; viewCount: number } }>('/api/brochure/share', owner.cookie)).body.share;
    expect(resumed.path).toBe(share.path); expect(resumed.viewCount).toBe(2);
    const town = await login('town@example.test');
    expect((await api('/api/admin/shares', { cookie: owner.cookie })).response.status).toBe(403);
    const report = await api<import('../src/shared/sharing-types.js').AdminSharePage>('/api/admin/shares?scope=fixture&page=999', { cookie: town.cookie });
    expect(report.body).toMatchObject({ total: 1, active: 1, totalViews: 2, page: 1 });
    expect(Object.keys(report.body.rows[0]!).sort()).toEqual(['id', 'userId', 'source', 'active', 'viewCount', 'createdAt', 'lastViewedAt'].sort());
    expect(JSON.stringify(report.body)).not.toContain(share.path.split('/').at(-1));
  });

  it('古いrevisionで再生成すると409を返し、保存済み編集を巻き戻さない', async () => {
    const owner = await login(), brochure = (await ensure(owner.cookie)).body.brochure;
    const local = payload(brochure), remote = payload(brochure);
    remote.items[0]!.comment = '別画面で保存したコメント';
    expect((await api('/api/brochure', { method: 'PUT', cookie: owner.cookie, body: JSON.stringify(remote) })).response.status).toBe(200);
    const result = await post<{ error: { code: string } }>('/api/brochure/regenerate', owner.cookie, { draft: local, mode: 'all', settings: { companion: '家族', duration: 'day', tripStyle: 'slow', visitedSpotIds: [brochure.items.find(item => item.kind === 'visited')!.spotId] } });
    expect(result.response.status).toBe(409); expect(result.body.error.code).toBe('revision_conflict');
    expect((await api<SessionData>('/api/session', { cookie: owner.cookie })).body.brochure!.items[0]!.comment).toBe(remote.items[0]!.comment);
  });
});
