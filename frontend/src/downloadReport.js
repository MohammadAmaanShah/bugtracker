import pptxgen from "pptxgenjs";
import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  WidthType,
  AlignmentType,
} from "docx";
import { mediaUrl } from "./api.js";

const statusLabel = (value) => {
  if (value === "in_progress") return "In Progress";
  if (value === "fixed") return "Fixed";
  return value || "—";
};

const titled = (bug) =>
  bug.number ? `#${bug.number} ${bug.title || "—"}` : bug.title || "—";

async function urlToDataUri(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function base64ToUint8(base64) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return arr;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function enrichWithImages(bugs) {
  return Promise.all(
    bugs.map(async (bug) => {
      const dataUri = bug.screenshot ? await urlToDataUri(mediaUrl(bug.screenshot)) : null;
      return { ...bug, imageDataUri: dataUri };
    })
  );
}

// ---------- Google Docs / Word (.docx) ----------

function buildDocxTable(rows) {
  const widths = [1728, 1440, 2016, 2880, 2160, 1440];
  const header = new TableRow({
    tableHeader: true,
    children: ["Reported by", "In Role", "Title", "Description", "Screenshot", "Status"].map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: true, color: "FFFFFF" })],
            }),
          ],
          shading: { fill: "37472F" },
        })
    ),
  });

  const body = rows.map(
    (bug) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: bug.reportedBy || "—" })] }),
          new TableCell({ children: [new Paragraph({ text: bug.role || "—" })] }),
          new TableCell({ children: [new Paragraph({ text: titled(bug) })] }),
          new TableCell({
            children: [new Paragraph({ text: bug.description || "—" })],
          }),
          new TableCell({
            children: [
              bug.imageDataUri
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        data: base64ToUint8(bug.imageDataUri.split(",")[1]),
                        transformation: { width: 130, height: 98 },
                      }),
                    ],
                  })
                : new Paragraph({ text: "—" }),
            ],
          }),
          new TableCell({
            children: [new Paragraph({ text: statusLabel(bug.status) })],
          }),
        ],
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [header, ...body],
  });
}

export async function downloadDocx(bugs) {
  const rows = await enrichWithImages(bugs);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Bug Report", bold: true, size: 36 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleString()} · ${rows.length} bug(s)`,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          buildDocxTable(rows),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(blob, `bug-report-${Date.now()}.docx`);
}

// ---------- PowerPoint (.pptx) ----------

const REPORT_COLUMNS = [
  { label: "Reported by", key: "reportedBy" },
  { label: "In Role", key: "role" },
  { label: "Title", key: "title" },
  { label: "Description", key: "description" },
  { label: "Screenshot", key: "screenshot" },
  { label: "Status", key: "status" },
];

const PDF_COLUMN_PARTS = [1728, 1440, 2016, 2880, 2160, 1440];

function pdfColumnWidths(maxWidth) {
  const total = PDF_COLUMN_PARTS.reduce((a, b) => a + b, 0);
  return PDF_COLUMN_PARTS.map((p) => (maxWidth * p) / total);
}

function getImageSize(dataUri) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUri;
  });
}

function estPptxRowHeight(bug, fontSize) {
  const lineH = (fontSize / 72) * 1.3;
  const charW = (fontSize / 72) * 0.55;
  const est = (width, value) =>
    Math.max(1, Math.ceil(String(value || "—").length / Math.floor(width / charW))) * lineH;
  return (
    0.12 +
    Math.max(
      0.6,
      est(1.83, bug.reportedBy),
      est(1.52, bug.role),
      est(2.13, bug.title),
      est(3.05, bug.description),
      est(1.52, statusLabel(bug.status))
    )
  );
}

async function buildPptx(bugs) {
  const rows = await enrichWithImages(bugs);
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "F4EEDF" };
  titleSlide.addText("Bug Report", {
    x: 0.6,
    y: 2.6,
    w: 12.1,
    h: 1.2,
    fontSize: 44,
    bold: true,
    color: "37472F",
    align: "center",
  });
  titleSlide.addText(
    `Generated on ${new Date().toLocaleString()} · ${bugs.length} bug(s)`,
    { x: 0.6, y: 3.9, w: 12.1, h: 0.6, fontSize: 18, color: "6F6350", align: "center" }
  );

  const colW = [1.83, 1.52, 2.13, 3.05, 2.29, 1.52];
  const fontSize = 12;

  const headerRow = REPORT_COLUMNS.map((col) => ({
    text: col.label,
    options: { bold: true, color: "FFFFFF", fill: { color: "37472F" }, fontSize },
  }));

  const bodyRow = (bug) =>
    REPORT_COLUMNS.map((col, i) => {
      if (col.key === "screenshot") {
        return bug.imageDataUri
          ? {
              image: {
                data: bug.imageDataUri,
                x: 0.02,
                y: 0.02,
                w: colW[i] - 0.09,
                h: 1.1,
                sizing: { type: "contain", w: colW[i] - 0.09, h: 1.1 },
              },
            }
          : { text: "—", options: { color: "3A2A06", fontSize } };
      }
      const text =
        col.key === "status" ? statusLabel(bug.status) : bug[col.key] || "—";
      const display =
        col.key === "title" && bug.number ? `#${bug.number} ${text}` : text;
      return {
        text: display,
        options: {
          color: "3A2A06",
          fontSize,
          bold: col.key === "title",
        },
      };
    });

  const availableHeight = 6.5;
  const pages = [];
  let pageRows = [];
  let used = 0;
  for (const bug of rows) {
    const h = estPptxRowHeight(bug, fontSize);
    if (pageRows.length && used + h > availableHeight) {
      pages.push(pageRows);
      pageRows = [bug];
      used = h;
    } else {
      pageRows.push(bug);
      used += h;
    }
  }
  if (pageRows.length) pages.push(pageRows);

  for (const chunk of pages) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addTable([headerRow, ...chunk.map(bodyRow)], {
      x: 0.5,
      y: 0.25,
      w: 12.33,
      colW,
      border: { type: "solid", pt: 1, color: "D9D2C5" },
      autoPage: false,
    });
  }

  await pptx.writeFile({ fileName: `bug-report-${Date.now()}.pptx` });
}

// ---------- PDF (.pdf) ----------

async function buildPdfTable(doc, rows, margin, maxWidth, pageHeight, bottomMargin) {
  const cols = REPORT_COLUMNS;
  const widths = pdfColumnWidths(maxWidth);
  const fontSize = 9;
  const lineHeight = 12;
  const padding = 4;
  const headerHeight = 22;

  const cellLines = (bug, col, w) => {
    const text =
      col.key === "status"
        ? statusLabel(bug.status)
        : col.key === "title" && bug.number
        ? `#${bug.number} ${bug[col.key] || "—"}`
        : bug[col.key] || "—";
    return doc.splitTextToSize(String(text), w - padding * 2);
  };

  const fitScreenshot = async (dataUri, w) => {
    const size = await getImageSize(dataUri);
    if (!size) return null;
    const maxW = w - padding * 2;
    const maxH = 70;
    const ratio = Math.min(maxW / size.width, maxH / size.height);
    return {
      w: size.width * ratio,
      h: size.height * ratio,
      format: dataUri.includes("image/png") ? "PNG" : "JPEG",
    };
  };

  const drawHeader = (y) => {
    let x = margin;
    doc.setFillColor(55, 71, 47);
    for (let i = 0; i < cols.length; i++) {
      doc.rect(x, y, widths[i], headerHeight, "FD");
      x += widths[i];
    }
    x = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(255, 255, 255);
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i].label, x + padding, y + padding + 4);
      x += widths[i];
    }
    return y + headerHeight;
  };

  let y = drawHeader(margin);

  for (const bug of rows) {
    const lines = cols.map((c, i) => cellLines(bug, c, widths[i]));
    const image = bug.imageDataUri ? await fitScreenshot(bug.imageDataUri, widths[4]) : null;

    let rowHeight = padding * 2 + lineHeight;
    for (const cell of lines) {
      rowHeight = Math.max(rowHeight, padding * 2 + cell.length * lineHeight);
    }
    if (image) rowHeight = Math.max(rowHeight, image.h + padding * 2);

    if (y + rowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = drawHeader(margin);
    }

    let x = margin;
    doc.setFontSize(fontSize);
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].key === "screenshot" && image) {
        doc.addImage(bug.imageDataUri, image.format, x + padding, y + padding, image.w, image.h);
      } else {
        doc.setFont("helvetica", cols[i].key === "title" ? "bold" : "normal");
        doc.setTextColor(58, 42, 6);
        let ty = y + padding + 8;
        for (const line of lines[i]) {
          doc.text(line, x + padding, ty);
          ty += lineHeight;
        }
      }
      x += widths[i];
    }

    x = margin;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    for (let i = 0; i < cols.length; i++) {
      doc.rect(x, y, widths[i], rowHeight);
      x += widths[i];
    }

    y += rowHeight;
  }

  return y;
}

export async function downloadPdf(bugs) {
  const rows = await enrichWithImages(bugs);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;

  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(55, 71, 47);
  doc.text("Bug Report", pageWidth / 2, y, { align: "center" });
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(111, 99, 80);
  doc.text(
    `Generated on ${new Date().toLocaleString()} · ${rows.length} bug(s)`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 36;

  await buildPdfTable(doc, rows, margin, maxWidth, pageHeight, margin);

  doc.save(`bug-report-${Date.now()}.pdf`);
}

export async function downloadReport(bugs, format) {
  if (format === "docx") return downloadDocx(bugs);
  if (format === "pdf") return downloadPdf(bugs);
  return buildPptx(bugs);
}
