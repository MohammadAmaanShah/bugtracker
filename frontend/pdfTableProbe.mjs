import { jsPDF } from "jspdf";
import { PDFParse } from "pdf-parse";
import { readFileSync } from "fs";

const doc = new jsPDF({ unit: "pt", format: "a4" });
let y = 60;
const cols = [60, 140, 80];
const headers = ["Title", "In Role", "Description", "Status"];
doc.setFont("helvetica", "bold");
doc.text(headers.join("    "), 50, y);
y += 20;
doc.setFont("helvetica", "normal");
const rows = [
  ["Login fails", "Customer", "Button does nothing", "In Progress"],
  ["Export crash", "Admin", "Exporting fails", "Fixed"],
];
for (const r of rows) {
  doc.text(r.join("    "), 50, y);
  y += 20;
}
const buf = Buffer.from(doc.output("arraybuffer"));
const out = "C:/Users/hp/AppData/Local/Temp/opencode/table-bugs.pdf";
import { writeFileSync } from "fs";
writeFileSync(out, buf);

const parser = new PDFParse({ data: new Uint8Array(buf) });
const text = await parser.getText();
console.log("=== getText ===");
console.log(JSON.stringify(text.text));
const tables = await parser.getTable();
console.log("=== getTable ===");
console.log(JSON.stringify(tables.mergedTables, null, 1));
