import {
  DEFAULT_SOURCE_DIRECTORY,
  ImportValidationError,
  importSampleData,
  inspectSampleData,
} from "./importer.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const withDemoAliases = args.includes("--with-demo-aliases");
  const positional = args.slice(1).filter((argument) => !argument.startsWith("--"));
  const sourceDirectory = positional[0] ?? DEFAULT_SOURCE_DIRECTORY;
  if (positional.length > 1 || args.some((argument) => argument.startsWith("--") && argument !== "--with-demo-aliases")) {
    throw new ImportValidationError("使用方法: import-cli.ts inspect|import [source-directory] [--with-demo-aliases]");
  }
  if (command === "inspect") {
    if (withDemoAliases) throw new ImportValidationError("--with-demo-aliases は import でのみ指定できます。");
    const counts = await inspectSampleData(sourceDirectory);
    console.log(JSON.stringify({ status: "valid", ...counts }, null, 2));
    return;
  }
  if (command === "import") {
    const result = await importSampleData(sourceDirectory, withDemoAliases);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new ImportValidationError("使用方法: import-cli.ts inspect|import [source-directory] [--with-demo-aliases]");
}

main().catch((error: unknown) => {
  if (error instanceof ImportValidationError) {
    console.error(`入力データを検証できません: ${error.message}`);
  } else {
    console.error("取り込みに失敗しました。DB設定と匿名検証結果を確認してください。");
  }
  process.exitCode = 1;
});
