import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const files = [
  "/Users/bin/Documents/GitHub/bazi/docs/1.天干四冲五合.xlsx",
  "/Users/bin/Documents/GitHub/bazi/docs/2.地支的刑冲合会害.xlsx",
];

for (const file of files) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const summary = await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 24000, tableMaxRows: 80, tableMaxCols: 16, tableMaxCellChars: 500 });
  const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
  console.log(`FILE ${file}\nSUMMARY\n${summary.ndjson}\nSHEETS\n${sheets.ndjson}`);
  const parsed = sheets.ndjson.split("\n").filter(Boolean).map(line => JSON.parse(line)).filter(item => item.name);
  for (const sheet of parsed) {
    const image = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
    const safe = `${file.includes("天干") ? "stems" : "branches"}-${sheet.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
    await fs.writeFile(new URL(safe, import.meta.url), new Uint8Array(await image.arrayBuffer()));
  }
}
