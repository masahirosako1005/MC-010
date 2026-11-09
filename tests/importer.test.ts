import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ImportValidationError,
  SAMPLE_FILES,
  loadAndValidateSampleData,
  normalizeEmail,
  normalizeHeader,
  parseSatisfaction,
  parseTokyoTimestamp,
  stableOrganizerUserId,
} from "../src/server/importer.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function csv(headers: string[], rows: string[][]): string {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `\uFEFF${headers.map(quote).join(",")}\n${rows.map((row) => row.map(quote).join(",")).join("\n")}\n`;
}

async function fixture(overrides: Partial<Record<keyof typeof SAMPLE_FILES, string>> = {}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "kondo-importer-"));
  temporaryDirectories.push(directory);
  const files: Record<keyof typeof SAMPLE_FILES, string> = {
    users: csv(
      ["ユーザーID", "ユーザー名", "メールアドレス（マスク済）", "性別", "年代", "居住地域", "スタンプ獲得数", "特典\n獲得数", "登録日時", "LINEユーザID", "LINEともだちブロック"],
      [
        ["u1", "非保存名", "***@***.***", "未使用", "未使用", "未使用", "1", "0", "2026-01-01 10:00:00", "", ""],
        ["u2", "非保存名", "***@***.***", "未使用", "未使用", "未使用", "0", "0", "2026-01-02 10:00:00", "", ""],
      ],
    ),
    afterSurvey: csv(
      ["user_id", "user_name", "is_line", "アンケート①(満足度を教えてください)", "アンケート②（旅で良かった点）", "アンケート③（要望がありましたら）"],
      [["u1", "非保存名", "false", "大変満足", "海の景色とカフェ", "保存しない本文"]],
    ),
    registrationSurvey: csv(
      ["user_id", "user_name", "is_line", "2488_性別", "2489_年齢", "2528_居住地", "2529_職業", "何で知りましたか？（複数選択可）"],
      [
        ["u1", "非保存名", "false", "未使用", "未使用", "未使用", "未使用", "未使用"],
        ["u2", "非保存名", "false", "未使用", "未使用", "未使用", "未使用", "未使用"],
      ],
    ),
    stamps: csv(
      ["ユーザID", "RAUND管理ユーザ名", "ユーザ名", "LINEログイン", "周回", "スタンプ名", "スポット名", "獲得日時"],
      [["u1", "", "非保存名", "false", "1", "月花の風車丘", "月花の風車丘（月灯集落）", "2026-02-03 12:34:56"]],
    ),
    rewards: csv(
      ["user_id", "username", "is_line", "reward_name", "prize_name", "timestamp"],
      [["u1", "非保存名", "false", "特典", "景品", "2026-02-03 13:00:00"]],
    ),
    ...overrides,
  };
  await Promise.all(
    (Object.keys(SAMPLE_FILES) as Array<keyof typeof SAMPLE_FILES>).map((kind) =>
      writeFile(join(directory, SAMPLE_FILES[kind]), files[kind], "utf8"),
    ),
  );
  return directory;
}

describe("import normalization", () => {
  it("normalizes headers, masked mail, satisfaction and Tokyo timestamps", () => {
    expect(normalizeHeader("\uFEFF特典\n 獲得数")).toBe("特典獲得数");
    expect(normalizeEmail(" ***@***.*** ")).toBeNull();
    expect(parseSatisfaction("大変満足")).toBe(5);
    expect(parseSatisfaction("３")).toBe(3);
    expect(parseTokyoTimestamp("2026-02-03 12:34:56")).toBe("2026-02-03T03:34:56.000Z");
    expect(stableOrganizerUserId("u1")).toBe(stableOrganizerUserId(" u1 "));
  });

  it("rejects invalid calendar dates", () => {
    expect(() => parseTokyoTimestamp("2026-02-30 12:00:00")).toThrow(ImportValidationError);
  });
});

describe("sample CSV validation", () => {
  it("validates all files and retains only required normalized data", async () => {
    const directory = await fixture();
    const data = await loadAndValidateSampleData(directory);
    expect(data.counts).toMatchObject({
      users: 2,
      usersWithVisits: 1,
      usersWithoutVisits: 1,
      maskedEmails: 2,
      stampEvents: 1,
      rewardEvents: 1,
    });
    expect(data.users[0]).toMatchObject({ email: null });
    expect(data.users[0]?.externalId).not.toContain("u1");
    expect(data.visits[0]).toMatchObject({ spotExternalId: "sample-spot-1" });
    expect(data.surveys[0]).toMatchObject({ satisfaction: 5, tags: ["景色", "海", "食"] });
  });

  it("rejects missing required headers", async () => {
    const directory = await fixture({
      rewards: csv(["user_id", "username", "is_line", "reward_name", "timestamp"], [["u1", "非保存名", "false", "特典", "2026-02-03 13:00:00"]]),
    });
    await expect(loadAndValidateSampleData(directory)).rejects.toThrow(/必須ヘッダー/u);
  });

  it("rejects orphan user references", async () => {
    const directory = await fixture({
      stamps: csv(
        ["ユーザID", "RAUND管理ユーザ名", "ユーザ名", "LINEログイン", "周回", "スタンプ名", "スポット名", "獲得日時"],
        [["missing", "", "非保存名", "false", "1", "月花の風車丘", "月花の風車丘（月灯集落）", "2026-02-03 12:34:56"]],
      ),
    });
    await expect(loadAndValidateSampleData(directory)).rejects.toThrow(/存在しないID/u);
  });

  it("rejects duplicate event keys and unknown spots", async () => {
    const row = ["u1", "", "非保存名", "false", "1", "月花の風車丘", "月花の風車丘（月灯集落）", "2026-02-03 12:34:56"];
    const duplicateDirectory = await fixture({
      stamps: csv(["ユーザID", "RAUND管理ユーザ名", "ユーザ名", "LINEログイン", "周回", "スタンプ名", "スポット名", "獲得日時"], [row, row]),
    });
    await expect(loadAndValidateSampleData(duplicateDirectory)).rejects.toThrow(/重複キー/u);

    const unknownDirectory = await fixture({
      stamps: csv(
        ["ユーザID", "RAUND管理ユーザ名", "ユーザ名", "LINEログイン", "周回", "スタンプ名", "スポット名", "獲得日時"],
        [["u1", "", "非保存名", "false", "1", "未登録", "未登録スポット", "2026-02-03 12:34:56"]],
      ),
    });
    await expect(loadAndValidateSampleData(unknownDirectory)).rejects.toThrow(/スポットマスター未登録/u);
  });
});
