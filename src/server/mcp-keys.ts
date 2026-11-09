import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './errors.js';
import { uuidSchema } from './validation.js';
import type { McpKey, McpSettings, IssuedMcpKey } from '../shared/mcp-types.js';

const MAX_KEYS = 5;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const fields = 'id,label,created_at,expires_at,last_used_at,revoked_at';
interface KeyRow {
  id: string; label: string; created_at: Date; expires_at: Date;
  last_used_at: Date | null; revoked_at: Date | null;
}
const mapKey = (row: KeyRow): McpKey => ({
  id: row.id, label: row.label, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(),
  lastUsedAt: row.last_used_at?.toISOString() ?? null, revokedAt: row.revoked_at?.toISOString() ?? null,
});

export function createMcpKeyRouter(db: pg.Pool) {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.accountRole !== 'town_admin') return next(new AppError(403, 'admin_required', '町側アカウントでログインしてください。'));
    next();
  });
  router.get('/mcp/keys', async (req, res) => {
    const { rows } = await db.query<KeyRow>(`SELECT ${fields} FROM admin_mcp_keys WHERE owner_id=$1
      ORDER BY (revoked_at IS NULL AND expires_at>now()) DESC,created_at DESC LIMIT 30`, [req.userId]);
    // Host is already restricted by the app's local-only middleware.
    res.json({ keys: rows.map(mapKey), endpoint: `http://${req.get('host')}/mcp`, maxActiveKeys: MAX_KEYS } satisfies McpSettings);
  });
  router.post('/mcp/keys', async (req, res) => {
    const input = z.object({ label: z.string().trim().min(1).max(60), days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }).strict().safeParse(req.body);
    if (!input.success) throw new AppError(400, 'invalid_mcp_key', '接続名は1〜60字、有効期間は7・30・90日から選んでください。');
    const token = `town_mcp_${randomBytes(32).toString('hex')}`;
    const key = await transaction(async client => {
      const owner = (await client.query("SELECT id FROM users WHERE id=$1 AND account_role='town_admin' FOR UPDATE", [req.userId])).rows[0];
      if (!owner) throw new AppError(403, 'admin_required', '町側アカウントでログインしてください。');
      const { count } = (await client.query('SELECT count(*)::int AS count FROM admin_mcp_keys WHERE owner_id=$1 AND revoked_at IS NULL AND expires_at>now()', [req.userId])).rows[0];
      if (count >= MAX_KEYS) throw new AppError(409, 'mcp_key_limit', '有効な接続キーは5件までです。不要なキーを失効してから発行してください。');
      const { rows } = await client.query<KeyRow>(`INSERT INTO admin_mcp_keys(id,owner_id,label,token_hash,expires_at)
        VALUES($1,$2,$3,$4,now()+$5::int*interval '1 day') RETURNING ${fields}`,
      [randomUUID(), req.userId, input.data.label, hash(token), input.data.days]);
      return mapKey(rows[0]!);
    }, db);
    res.status(201).json({ key, token } satisfies IssuedMcpKey);
  });
  router.delete('/mcp/keys/:id', async (req, res) => {
    const id = uuidSchema.parse(req.params.id);
    const { rowCount } = await db.query('UPDATE admin_mcp_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND owner_id=$2', [id, req.userId]);
    if (!rowCount) throw new AppError(404, 'not_found', '接続キーが見つかりません。');
    res.json({ ok: true });
  });
  return router;
}

export async function authenticateMcpKey(db: pg.Pool, authorization: string | undefined): Promise<string | null> {
  const match = /^Bearer (town_mcp_[a-f0-9]{64})$/i.exec(authorization ?? '');
  if (!match) return null;
  const { rows } = await db.query(`UPDATE admin_mcp_keys k SET last_used_at=now() FROM users u
    WHERE k.owner_id=u.id AND u.account_role='town_admin' AND k.token_hash=$1
      AND k.revoked_at IS NULL AND k.expires_at>now() RETURNING k.id`, [hash(match[1]!)]);
  return rows[0]?.id ?? null;
}
