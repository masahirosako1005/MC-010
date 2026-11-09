import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { PoolClient } from "pg";

export const DEFAULT_SOURCE_DIRECTORY = "C:/AI-Sprint/sample-data";

export const SAMPLE_FILES = {
  afterSurvey: "08_アンケート回答_参加後.csv",
  registrationSurvey: "09_アンケート回答_登録時.csv",
  stamps: "12_スタンプ獲得履歴.csv",
  users: "13_ユーザー一覧.csv",
  rewards: "18_特典獲得履歴.csv",
} as const;

const MAX_CSV_BYTES = 20 * 1024 * 1024;

const REQUIRED_HEADERS = {
  afterSurvey: [
    "user_id",
    "user_name",
    "is_line",
    "アンケート①(満足度を教えてください)",
    "アンケート②（旅で良かった点）",
    "アンケート③（要望がありましたら）",
  ],
  registrationSurvey: [
    "user_id",
    "user_name",
    "is_line",
    "2488_性別",
    "2489_年齢",
    "2528_居住地",
    "2529_職業",
    "何で知りましたか？（複数選択可）",
  ],
  stamps: [
    "ユーザID",
    "RAUND管理ユーザ名",
    "ユーザ名",
    "LINEログイン",
    "周回",
    "スタンプ名",
    "スポット名",
    "獲得日時",
  ],
  users: [
    "ユーザーID",
    "ユーザー名",
    "メールアドレス（マスク済）",
    "性別",
    "年代",
    "居住地域",
    "スタンプ獲得数",
    "特典獲得数",
    "登録日時",
    "LINEユーザID",
    "LINEともだちブロック",
  ],
  rewards: [
    "user_id",
    "username",
    "is_line",
    "reward_name",
    "prize_name",
    "timestamp",
  ],
} as const;

const SPOT_PREFIXES = [
  "月花の風車丘",
  "星綾の潮見台",
  "雪雫の音楽堂",
  "灯雲の石畳通り",
  "虹灯りの夜市",
  "風詠みの灯台",
  "瑠璃凪の水鏡湖",
] as const;

type CsvRow = Record<string, string>;

export interface OrganizerUser {
  id: string;
  externalId: string;
  sourceId: string;
  email: string | null;
}

export interface OrganizerVisit {
  id: string;
  userId: string;
  userSourceId: string;
  spotExternalId: string;
  visitedAt: string;
  sourceKey: string;
}

export interface OrganizerSurvey {
  userId: string;
  satisfaction: number;
  goodPoints: string;
  tags: string[];
}

export interface ImportCounts {
  users: number;
  registrationSurveys: number;
  afterSurveys: number;
  stampEvents: number;
  rewardEvents: number;
  usersWithVisits: number;
  usersWithoutVisits: number;
  maskedEmails: number;
  usableEmails: number;
  spots: number;
}

export interface ValidatedSampleData {
  sourceHash: string;
  users: OrganizerUser[];
  visits: OrganizerVisit[];
  surveys: OrganizerSurvey[];
  counts: ImportCounts;
}

export interface ImportResult extends ImportCounts {
  status: "imported" | "already_imported";
  aliasesEnsured: boolean;
}

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/u, "").replace(/\s+/gu, "").trim();
}

function hashHex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashToUuid(value: string): string {
  const bytes = createHash("sha256").update(value, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function stableOrganizerUserId(sourceId: string): string {
  return hashToUuid(`organizer-user:${sourceId.trim()}`);
}

function privateExternalId(sourceId: string): string {
  return `organizer:${hashHex(`organizer-external:${sourceId.trim()}`).slice(0, 32)}`;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || /[*＊]/u.test(email)) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
    throw new ImportValidationError("ユーザー一覧に形式不正の非マスクメールがあります。");
  }
  return email;
}

export function parseSatisfaction(value: string): number {
  const normalized = value.trim();
  const labels: Record<string, number> = {
    大変不満: 1,
    やや不満: 2,
    普通: 3,
    やや満足: 4,
    大変満足: 5,
  };
  if (labels[normalized] !== undefined) return labels[normalized];
  const ascii = normalized.replace(/[１-５]/gu, (digit) =>
    String("１２３４５".indexOf(digit) + 1),
  );
  if (/^[1-5]$/u.test(ascii)) return Number(ascii);
  throw new ImportValidationError("参加後アンケートに未対応の満足度があります。");
}

export function parseTokyoTimestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value.trim());
  if (!match) throw new ImportValidationError("日時形式は yyyy-MM-dd HH:mm:ss である必要があります。");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    year < 2000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > lastDay ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new ImportValidationError("範囲外の日時があります。");
  }
  return new Date(`${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}+09:00`).toISOString();
}

function deriveTags(goodPoints: string): string[] {
  const rules: Array<[string, RegExp]> = [
    ["nature", /自然|景色|海|湖|山|花|風/u],
    ["food", /食|料理|グルメ|カフェ|甘味/u],
    ["culture", /歴史|文化|街|建物|石畳/u],
    ["event", /音楽|祭|イベント|夜市/u],
  ];
  return rules.filter(([, pattern]) => pattern.test(goodPoints)).map(([tag]) => tag);
}

function spotExternalId(sourceName: string): string {
  const index = SPOT_PREFIXES.findIndex((prefix) => sourceName.trim().startsWith(prefix));
  if (index < 0) throw new ImportValidationError("スタンプ履歴にスポットマスター未登録の名称があります。");
  return `sample-spot-${index + 1}`;
}

function assertRequired(row: CsvRow, columns: readonly string[], file: string, rowIndex: number): void {
  for (const column of columns) {
    if (!row[column]?.trim()) {
      throw new ImportValidationError(`${file} の${rowIndex + 2}行目で必須列「${column}」が空です。`);
    }
  }
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new ImportValidationError(`${label} に重複キーがあります。`);
    seen.add(value);
  }
}

function parseCsv(bytes: Buffer, requiredHeaders: readonly string[], file: string): CsvRow[] {
  if (bytes.byteLength > MAX_CSV_BYTES) {
    throw new ImportValidationError(`${file} が許可サイズを超えています。`);
  }
  let rows: CsvRow[];
  try {
    rows = parse(bytes, {
      bom: true,
      columns: (headers: string[]) => {
        const normalized = headers.map(normalizeHeader);
        assertUnique(normalized, `${file} のヘッダー`);
        return normalized;
      },
      encoding: "utf8",
      skip_empty_lines: true,
      relax_column_count: false,
      trim: false,
    }) as CsvRow[];
  } catch (error) {
    if (error instanceof ImportValidationError) throw error;
    throw new ImportValidationError(`${file} をCSVとして解析できません。`);
  }
  const actualHeaders = new Set(Object.keys(rows[0] ?? {}));
  for (const header of requiredHeaders) {
    if (!actualHeaders.has(header)) {
      throw new ImportValidationError(`${file} に必須ヘッダー「${header}」がありません。`);
    }
  }
  if (rows.length === 0) throw new ImportValidationError(`${file} にデータ行がありません。`);
  return rows;
}

function validateOrphans(rows: CsvRow[], idColumn: string, userIds: Set<string>, file: string): void {
  if (rows.some((row) => !userIds.has(row[idColumn]!.trim()))) {
    throw new ImportValidationError(`${file} にユーザーマスターへ存在しないIDがあります。`);
  }
}

function compositeKey(parts: string[]): string {
  return parts.map((part) => part.trim()).join("\u001f");
}

export async function loadAndValidateSampleData(
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
): Promise<ValidatedSampleData> {
  const directory = resolve(sourceDirectory);
  const entries = await Promise.all(
    Object.entries(SAMPLE_FILES).map(async ([kind, file]) => {
      let bytes: Buffer;
      try {
        bytes = await readFile(join(directory, file));
      } catch {
        throw new ImportValidationError(`必須ファイル ${file} を読み取れません。`);
      }
      return { kind: kind as keyof typeof SAMPLE_FILES, file, bytes };
    }),
  );
  const byKind = new Map(entries.map((entry) => [entry.kind, entry]));
  const getRows = <K extends keyof typeof SAMPLE_FILES>(kind: K): CsvRow[] => {
    const entry = byKind.get(kind)!;
    return parseCsv(entry.bytes, REQUIRED_HEADERS[kind], entry.file);
  };

  const userRows = getRows("users");
  const afterRows = getRows("afterSurvey");
  const registrationRows = getRows("registrationSurvey");
  const stampRows = getRows("stamps");
  const rewardRows = getRows("rewards");

  userRows.forEach((row, index) => assertRequired(row, ["ユーザーID", "メールアドレス（マスク済）", "登録日時"], SAMPLE_FILES.users, index));
  afterRows.forEach((row, index) => assertRequired(row, ["user_id", "アンケート①(満足度を教えてください)", "アンケート②（旅で良かった点）"], SAMPLE_FILES.afterSurvey, index));
  registrationRows.forEach((row, index) => assertRequired(row, ["user_id"], SAMPLE_FILES.registrationSurvey, index));
  stampRows.forEach((row, index) => assertRequired(row, ["ユーザID", "スタンプ名", "スポット名", "獲得日時"], SAMPLE_FILES.stamps, index));
  rewardRows.forEach((row, index) => assertRequired(row, ["user_id", "reward_name", "prize_name", "timestamp"], SAMPLE_FILES.rewards, index));

  const sourceUserIds = userRows.map((row) => row["ユーザーID"]!.trim());
  assertUnique(sourceUserIds, "ユーザー一覧");
  assertUnique(afterRows.map((row) => row.user_id!.trim()), "参加後アンケート");
  assertUnique(registrationRows.map((row) => row.user_id!.trim()), "登録時アンケート");
  assertUnique(
    stampRows.map((row) => compositeKey([row["ユーザID"]!, row["スタンプ名"]!, row["スポット名"]!, row["獲得日時"]!])),
    "スタンプ履歴",
  );
  assertUnique(
    rewardRows.map((row) => compositeKey([row.user_id!, row.reward_name!, row.prize_name!, row.timestamp!])),
    "特典履歴",
  );
  const userIdSet = new Set(sourceUserIds);
  validateOrphans(afterRows, "user_id", userIdSet, SAMPLE_FILES.afterSurvey);
  validateOrphans(registrationRows, "user_id", userIdSet, SAMPLE_FILES.registrationSurvey);
  validateOrphans(stampRows, "ユーザID", userIdSet, SAMPLE_FILES.stamps);
  validateOrphans(rewardRows, "user_id", userIdSet, SAMPLE_FILES.rewards);

  const users = userRows.map<OrganizerUser>((row) => {
    parseTokyoTimestamp(row["登録日時"]!);
    const sourceId = row["ユーザーID"]!.trim();
    return {
      id: stableOrganizerUserId(sourceId),
      externalId: privateExternalId(sourceId),
      sourceId,
      email: normalizeEmail(row["メールアドレス（マスク済）"]!),
    };
  });
  assertUnique(
    users.flatMap((user) => (user.email ? [user.email] : [])),
    "ユーザー一覧の非マスクメール",
  );

  const visits = stampRows.map<OrganizerVisit>((row) => {
    const userSourceId = row["ユーザID"]!.trim();
    const visitedAt = parseTokyoTimestamp(row["獲得日時"]!);
    const sourceKey = hashHex(
      `organizer-stamp:${compositeKey([userSourceId, row["スタンプ名"]!, row["スポット名"]!, visitedAt])}`,
    );
    return {
      id: hashToUuid(`organizer-visit:${sourceKey}`),
      userId: stableOrganizerUserId(userSourceId),
      userSourceId,
      spotExternalId: spotExternalId(row["スポット名"]!),
      visitedAt,
      sourceKey,
    };
  });

  rewardRows.forEach((row) => parseTokyoTimestamp(row.timestamp!));
  const surveys = afterRows.map<OrganizerSurvey>((row) => {
    const sourceId = row.user_id!.trim();
    const goodPoints = row["アンケート②（旅で良かった点）"]!.trim();
    return {
      userId: stableOrganizerUserId(sourceId),
      satisfaction: parseSatisfaction(row["アンケート①(満足度を教えてください)"]!),
      goodPoints,
      tags: deriveTags(goodPoints),
    };
  });

  const usersWithVisits = new Set(visits.map((visit) => visit.userId));
  const counts: ImportCounts = {
    users: users.length,
    registrationSurveys: registrationRows.length,
    afterSurveys: surveys.length,
    stampEvents: visits.length,
    rewardEvents: rewardRows.length,
    usersWithVisits: usersWithVisits.size,
    usersWithoutVisits: users.length - usersWithVisits.size,
    maskedEmails: users.filter((user) => user.email === null).length,
    usableEmails: users.filter((user) => user.email !== null).length,
    spots: new Set(visits.map((visit) => visit.spotExternalId)).size,
  };

  const sourceHash = createHash("sha256");
  for (const entry of entries.sort((a, b) => a.file.localeCompare(b.file, "ja"))) {
    sourceHash.update(entry.file, "utf8");
    sourceHash.update(Buffer.from([0]));
    sourceHash.update(entry.bytes);
    sourceHash.update(Buffer.from([0]));
  }
  return { sourceHash: sourceHash.digest("hex"), users, visits, surveys, counts };
}

export async function inspectSampleData(
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
): Promise<ImportCounts> {
  return (await loadAndValidateSampleData(sourceDirectory)).counts;
}

async function ensureDemoAliases(client: PoolClient, data: ValidatedSampleData): Promise<void> {
  const visitedSpotCounts = new Map<string, Set<string>>();
  for (const visit of data.visits) {
    const spots = visitedSpotCounts.get(visit.userId) ?? new Set<string>();
    spots.add(visit.spotExternalId);
    visitedSpotCounts.set(visit.userId, spots);
  }
  const withHistory = data.users
    .filter((user) => {
      const count = visitedSpotCounts.get(user.id)?.size ?? 0;
      return count > 0 && count < SPOT_PREFIXES.length;
    })
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const withoutHistory = data.users
    .filter((user) => !visitedSpotCounts.has(user.id))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!withHistory || !withoutHistory) {
    throw new ImportValidationError("デモ別名に必要な履歴あり・履歴なし利用者を選べません。");
  }
  await client.query(
    `INSERT INTO auth_aliases (email, user_id, label)
     VALUES ($1, $2, $3), ($4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, label = EXCLUDED.label`,
    [
      "sample@example.test",
      withHistory.id,
      "サンプル（履歴あり）",
      "sample-empty@example.test",
      withoutHistory.id,
      "サンプル（履歴なし）",
    ],
  );
}

async function writeImportedRows(client: PoolClient, data: ValidatedSampleData): Promise<void> {
  for (const user of data.users) {
    await client.query(
      `INSERT INTO users (id, external_id, email, display_name, source)
       VALUES ($1, $2, $3, $4, 'organizer')
       ON CONFLICT (external_id) DO UPDATE
       SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, source = 'organizer'`,
      [user.id, user.externalId, user.email, "サンプル利用者"],
    );
  }

  const spots = await client.query<{ id: string; external_id: string }>(
    `SELECT id, external_id FROM spots WHERE external_id = ANY($1::text[])`,
    [SPOT_PREFIXES.map((_, index) => `sample-spot-${index + 1}`)],
  );
  const spotIds = new Map(spots.rows.map((spot) => [spot.external_id, spot.id]));
  if (spotIds.size !== SPOT_PREFIXES.length) {
    throw new ImportValidationError("DBのサンプルスポットマスターが不足しています。先にmigration/seedを実行してください。");
  }
  for (const visit of data.visits) {
    await client.query(
      `INSERT INTO visits (id, user_id, spot_id, visited_at, stamp, source_key)
       VALUES ($1, $2, $3, $4, true, $5)
       ON CONFLICT (source_key) DO NOTHING`,
      [visit.id, visit.userId, spotIds.get(visit.spotExternalId), visit.visitedAt, visit.sourceKey],
    );
  }
  for (const survey of data.surveys) {
    await client.query(
      `INSERT INTO surveys (user_id, satisfaction, good_points, tags, previous_companion)
       VALUES ($1, $2, $3, $4::text[], NULL)
       ON CONFLICT (user_id) DO UPDATE
       SET satisfaction = EXCLUDED.satisfaction,
           good_points = EXCLUDED.good_points,
           tags = EXCLUDED.tags`,
      [survey.userId, survey.satisfaction, survey.goodPoints, survey.tags],
    );
  }
}

export async function importSampleData(
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
  withDemoAliases = false,
): Promise<ImportResult> {
  const data = await loadAndValidateSampleData(sourceDirectory);
  const { pool } = await import("./db.js");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const run = await client.query(
      `INSERT INTO import_runs (id, source_hash, counts)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (source_hash) DO NOTHING
       RETURNING id`,
      [hashToUuid(`import-run:${data.sourceHash}`), data.sourceHash, JSON.stringify(data.counts)],
    );
    const imported = run.rowCount === 1;
    if (imported) await writeImportedRows(client, data);
    if (withDemoAliases) await ensureDemoAliases(client, data);
    await client.query("COMMIT");
    return {
      status: imported ? "imported" : "already_imported",
      aliasesEnsured: withDemoAliases,
      ...data.counts,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
