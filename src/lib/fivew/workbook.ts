import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";

const TEMPLATE = path.join(process.cwd(), "src/lib/fivew/cpaor-5ws-template.xlsm");
const TRACKER_SHEET = "xl/worksheets/sheet2.xml"; // "2_CP AoR 5Ws Tracker"
const FIRST_DATA_ROW = 2;
const LAST_TEMPLATE_ROW = 7776;

export type CellValue = string | number | { date: string } | null | undefined;
export type TrackerRow = Record<string, CellValue>;

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // characters XML 1.0 does not allow
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// Excel stores dates as days since 1899-12-30.
function excelSerial(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

function cellXml(ref: string, style: string, value: CellValue) {
  if (typeof value === "number") return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if (value && typeof value === "object") return `<c r="${ref}"${style}><v>${excelSerial(value.date)}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
}

/**
 * Fills the tracker sheet of the official template, one row per entry, by
 * editing the sheet XML in place: every pre-formatted cell keeps its style,
 * and the template's formulas, dropdowns, macros and other sheets are left
 * untouched. Formula columns (C, D, Y, AE, AJ) are never written; Excel
 * recalculates them when the file is opened.
 */
export async function fillTracker(rows: TrackerRow[]): Promise<Buffer> {
  if (rows.length > LAST_TEMPLATE_ROW - FIRST_DATA_ROW + 1) throw new Error("عدد الصفوف أكبر من سعة القالب");

  const zip = await JSZip.loadAsync(await readFile(TEMPLATE));
  const sheet = zip.file(TRACKER_SHEET);
  if (!sheet) throw new Error("القالب لا يحتوي ورقة 5Ws Tracker");
  const xml = await sheet.async("string");

  if (rows.length > 0) {
    const lastRow = FIRST_DATA_ROW + rows.length - 1;
    const start = xml.indexOf(`<row r="${FIRST_DATA_ROW}" `);
    const endTag = xml.indexOf("</row>", xml.indexOf(`<row r="${lastRow}" `)) + "</row>".length;
    if (start < 0 || endTag < start) throw new Error("بنية القالب غير متوقعة");

    const block = xml.slice(start, endTag).replace(/<row r="(\d+)"[\s\S]*?<\/row>/g, (rowXml, n) => {
      const values = rows[Number(n) - FIRST_DATA_ROW];
      if (!values) return rowXml;
      let out = rowXml;
      for (const [col, value] of Object.entries(values)) {
        if (value === null || value === undefined || value === "") continue;
        const ref = `${col}${n}`;
        const match = out.match(new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`));
        if (!match) throw new Error(`الخلية ${ref} غير موجودة في القالب`);
        const style = match[1].match(/ s="\d+"/)?.[0] ?? "";
        out = out.replace(match[0], cellXml(ref, style, value));
      }
      return out;
    });
    zip.file(TRACKER_SHEET, xml.slice(0, start) + block + xml.slice(endTag), { createFolders: false });
  }

  // Recalculate the template's formula columns (partner acronym, unit, totals) on open.
  const wb = zip.file("xl/workbook.xml")!;
  const wbXml = (await wb.async("string")).replace(/<calcPr([^>]*?)\/>/, (m, attrs: string) =>
    attrs.includes("fullCalcOnLoad") ? m : `<calcPr${attrs} fullCalcOnLoad="1"/>`
  );
  zip.file("xl/workbook.xml", wbXml, { createFolders: false });

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
