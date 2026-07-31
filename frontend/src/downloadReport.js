import pptxgen from "pptxgenjs";
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

const statusLabel = (value) => {
  if (value === "in_progress") return "In Progress";
  if (value === "fixed") return "Fixed";
  return value || "—";
};

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
      const dataUri = bug.screenshot ? await urlToDataUri(bug.screenshot) : null;
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
          new TableCell({ children: [new Paragraph({ text: bug.title || "—" })] }),
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

async function buildPptx(bugs) {
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

  for (const bug of bugs) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    slide.addText(bug.title || "Untitled", {
      x: 0.5,
      y: 0.35,
      w: 12.3,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: "37472F",
    });

    slide.addText(
      [
        { text: "Reported by: ", options: { bold: true, color: "6F6350" } },
        { text: bug.reportedBy || "—", options: { color: "3A2A06" } },
      ],
      { x: 0.5, y: 1.2, w: 4, h: 0.4, fontSize: 14 }
    );
    slide.addText(
      [
        { text: "In Role: ", options: { bold: true, color: "6F6350" } },
        { text: bug.role || "—", options: { color: "3A2A06" } },
      ],
      { x: 4.7, y: 1.2, w: 4, h: 0.4, fontSize: 14 }
    );
    slide.addText(
      [
        { text: "Status: ", options: { bold: true, color: "6F6350" } },
        { text: statusLabel(bug.status), options: { color: "3A2A06" } },
      ],
      { x: 8.9, y: 1.2, w: 3.9, h: 0.4, fontSize: 14 }
    );

    slide.addText(bug.description || "No description", {
      x: 0.5,
      y: 1.9,
      w: bug.imageDataUri ? 7.3 : 12.3,
      h: 4.9,
      fontSize: 14,
      color: "3A2A06",
      valign: "top",
    });

    if (bug.imageDataUri) {
      slide.addImage({
        data: bug.imageDataUri,
        x: 8.1,
        y: 1.9,
        w: 4.7,
        h: 4.9,
        sizing: { type: "contain", w: 4.7, h: 4.9 },
      });
    }
  }

  await pptx.writeFile({ fileName: `bug-report-${Date.now()}.pptx` });
}

export async function downloadReport(bugs, format) {
  if (format === "docx") return downloadDocx(bugs);
  return buildPptx(bugs);
}
