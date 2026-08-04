import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfImages } from "./pdfImages.js";
import path from "path";

const HEADER_ALIASES = {
  title: ["title"],
  role: ["role", "inrole", "inrole"],
  description: ["description", "desc"],
  reportedBy: ["reportedby", "reported", "reported_by", "reportedbyuser"],
  assignedTo: ["assignto", "assignedto", "assign", "assigned"],
  status: ["status"],
};

const norm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, "");

const fieldForHeader = (header) => {
  const key = norm(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(key)) return field;
  }
  return null;
};

const mapStatus = (value) => {
  const key = norm(value);
  if (
    key === "fixed" ||
    key === "closed" ||
    key === "done" ||
    key === "resolved" ||
    key === "completed" ||
    key === "complete"
  ) {
    return "fixed";
  }
  return "in_progress";
};

const mapRow = (row) => {
  const bug = {
    title: (row.title || "").trim(),
    role: (row.role || "").trim(),
    description: (row.description || "").trim(),
    reportedBy: (row.reportedBy || "").trim(),
    assignedTo: (row.assignedTo || "").trim(),
    status: mapStatus(row.status),
  };

  if (!bug.title || !bug.role || !bug.description) {
    const missing = ["title", "role", "description"]
      .filter((f) => !bug[f])
      .join(", ");
    return { bug: null, reason: `missing ${missing}` };
  }

  return { bug, reason: null };
};

const collectRows = (rows) => {
  const bugs = [];
  const skipped = [];

  rows.forEach((row, index) => {
    const { bug, reason } = mapRow(row);
    if (bug) bugs.push(bug);
    else skipped.push({ row: index + 1, reason });
  });

  return { bugs, skipped };
};

const parseCsv = (buffer) => {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  const rows = records
    .map((record) => {
      const row = {};
      for (const [header, value] of Object.entries(record)) {
        const field = fieldForHeader(header);
        if (field) row[field] = value;
      }
      return row;
    })
    .filter((row) => Object.keys(row).length > 0);
  return collectRows(rows);
};

const parseExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { bugs: [], skipped: [] };

  const rows = [];
  let headerMap = null;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1);
    if (!headerMap) {
      headerMap = {};
      values.forEach((cell, idx) => {
        const field = fieldForHeader(cell);
        if (field) headerMap[idx] = field;
      });
      return;
    }
    const mapped = {};
    values.forEach((cell, idx) => {
      if (headerMap[idx] !== undefined) mapped[headerMap[idx]] = cell;
    });
    rows.push(mapped);
  });

  return collectRows(rows);
};

const extractXmlText = (xml, tags) => {
  const values = [];
  const pattern = new RegExp(`<${tags}[^>]*>([\\s\\S]*?)<\\/${tags}>`, "g");
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    values.push(match[1]);
  }
  return values;
};

const stripXml = (xml) => xml.replace(/<[^>]+>/g, "");

const parseDocx = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("Invalid DOCX file");

  const tables = extractXmlText(docXml, "w:tbl");
  const rows = [];

  for (const table of tables) {
    const trs = extractXmlText(table, "w:tr");
    let headerMap = null;

    for (const tr of trs) {
      const tcs = extractXmlText(tr, "w:tc");
      const cells = tcs.map((tc) => {
        const texts = extractXmlText(tc, "w:t");
        return texts
          .map((t) => stripXml(t).replace(/&amp;/g, "&").trim())
          .join(" ");
      });

      if (headerMap === null) {
        const matched = cells.filter((cell) => fieldForHeader(cell)).length;
        if (matched >= 2) {
          headerMap = {};
          cells.forEach((cell, ci) => {
            const field = fieldForHeader(cell);
            if (field) headerMap[ci] = field;
          });
        }
        continue;
      }

      const mapped = {};
      Object.entries(headerMap).forEach(([ci, field]) => {
        if (cells[ci] !== undefined) mapped[field] = cells[ci];
      });
      rows.push(mapped);
    }
    break;
  }

  return collectRows(rows);
};

const parsePptx = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const num = (name) => parseInt(name.match(/\d+/)[0], 10);
      return num(a) - num(b);
    });

  const bugs = [];
  const skipped = [];

  for (let i = 0; i < slideNames.length; i += 1) {
    if (i === 0) continue;

    const slideXml = await zip.file(slideNames[i]).async("string");
    const paragraphs = extractXmlText(slideXml, "a:p").map((p) =>
      stripXml(p)
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
    );

    let title = "";
    let reportedBy = "";
    let role = "";
    let status = "";
    const descriptionLines = [];

    for (const para of paragraphs) {
      const reported = para.match(/^reported\s*by:\s*(.*)$/i);
      const roleMatch = para.match(/^in\s*role:\s*(.*)$/i);
      const statusMatch = para.match(/^status:\s*(.*)$/i);

      if (reported) reportedBy = reported[1].trim();
      else if (roleMatch) role = roleMatch[1].trim();
      else if (statusMatch) status = statusMatch[1].trim();
      else if (!title) title = para;
      else descriptionLines.push(para);
    }

    const row = {
      title,
      role,
      description: descriptionLines.join("\n"),
      reportedBy,
      assignedTo: "",
      status: mapStatus(status),
    };

    const { bug, reason } = mapRow(row);
    if (bug) bugs.push(bug);
    else skipped.push({ row: i + 1, reason });
  }

  return { bugs, skipped };
};

const PDF_LABEL_RE = {
  title: /^(?:title|subject|summary)\s*:\s*(.*)$/i,
  role: /^(?:in\s*role|role|as)\s*:\s*(.*)$/i,
  description: /^(?:description|details|notes|desc)\s*:\s*(.*)$/i,
  reportedBy: /^(?:reported\s*by|reporter|reported|by)\s*:\s*(.*)$/i,
  assignedTo: /^(?:assign(?:ed)?\s*to|assignee)\s*:\s*(.*)$/i,
  status: /^(?:status|state)\s*:\s*(.*)$/i,
};

const PDF_HAS_LABEL_RE =
  /^\s*(?:title|subject|summary|in\s*role|role|description|details|notes|reported\s*by|reporter|assign(?:ed)?\s*to|assignee|status|state)\s*:/i;

const PDF_NOISE_RE = [
  /^bug report$/i,
  /^generated on /i,
  /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/i,
];

const PDF_SECTION_RE = /^(?:bug|issue|case)\s+(?:report\s+)?#?\s*\d+\s*(?:$|[:.\-])/i;

const STATUS_KEYWORD_RE =
  /^(?:open|in\s*progress|in-progress|progress|pending|new|todo|to\s*do|fixed|closed|resolved|done|completed|complete|not\s*fixed)$/i;

const KNOWN_ROLES = new Set([
  "admin",
  "administrator",
  "user",
  "customer",
  "client",
  "worker",
  "employee",
  "guest",
  "tester",
  "qa",
  "developer",
  "dev",
  "manager",
  "operator",
  "seller",
  "buyer",
  "delivery",
  "rider",
  "owner",
  "staff",
  "executive",
  "supervisor",
  "agent",
  "general",
]);

const emptyBug = () => ({
  title: "",
  role: "",
  description: "",
  reportedBy: "",
  assignedTo: "",
  status: "",
});

const titleCase = (value) => {
  const v = String(value || "").trim();
  if (!v) return v;
  return v
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

const isModuleLine = (line) => {
  const v = String(line || "").trim();
  if (!v || v.length > 24) return false;
  if (/\s/.test(v)) return false;
  return /^[A-Za-z][A-Za-z0-9&.'\-]*$/.test(v) && !v.endsWith(".");
};

const detectModuleFormat = (lines) => {
  if (lines.some((line) => PDF_HAS_LABEL_RE.test(line))) return false;
  const meaningful = lines.filter(
    (line) => !PDF_NOISE_RE.some((rx) => rx.test(line))
  );
  if (meaningful.length === 0) return false;
  let moduleCount = 0;
  for (let i = 0; i < meaningful.length - 1; i += 1) {
    const line = meaningful[i];
    const next = meaningful[i + 1];
    if (isModuleLine(line) && next.split(/\s+/).length >= 2) {
      moduleCount += 1;
    }
  }
  return moduleCount >= 3;
};

const parseModulePdf = (lines) => {
  const bugs = [];
  const skipped = [];
  let current = null;
  let currentPage = 1;
  let entryCount = 0;

  const flush = () => {
    if (!current) return;
    entryCount += 1;
    const row = { ...current, status: mapStatus(current.status) };
    const { bug, reason } = mapRow(row);
    if (bug) {
      bug.page = current.page;
      bugs.push(bug);
    } else {
      skipped.push({ row: entryCount, reason });
    }
    current = null;
  };

  for (const line of lines) {
    if (PDF_NOISE_RE.some((rx) => rx.test(line))) {
      const fm = line.match(/^--\s*(\d+)\s+of\s+\d+\s*--$/i);
      if (fm) currentPage = Number(fm[1]) + 1;
      continue;
    }

    if (isModuleLine(line)) {
      if (!current) {
        current = { ...emptyBug(), role: titleCase(line), page: currentPage };
      } else if (current.title && current.description) {
        flush();
        current = { ...emptyBug(), role: titleCase(line), page: currentPage };
      } else {
        current.description = current.description
          ? `${current.description}\n${line}`
          : line;
      }
      continue;
    }

    if (!current) continue;

    if (!current.title) current.title = line;
    else
      current.description = current.description
        ? `${current.description}\n${line}`
        : line;
  }
  flush();
  return { bugs, skipped };
};

const TABLE_COLUMN_LABELS = ["Reported by", "In Role", "Title", "Description", "Screenshot", "Status"];

const detectTablePdf = (lines) =>
  lines.some(
    (line) =>
      line.includes("Reported by") &&
      line.includes("In Role") &&
      line.includes("Screenshot") &&
      line.includes("Status")
  );

const parseTablePdf = async (buffer) => {
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise;

  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items
        .filter((it) => it && it.str && it.str.trim())
        .map((it) => ({
          x: it.transform[4],
          y: it.transform[5],
          str: it.str,
        }))
    );
  }

  const bugs = [];
  const skipped = [];
  let entryCount = 0;

  for (let p = 0; p < pages.length; p += 1) {
    const items = pages[p];
    const header = items.find(
      (it) =>
        it.x >= 0 &&
        it.x < 200 &&
        /reported\s*by/i.test(it.str) &&
        items.some(
          (o) =>
            Math.abs(o.y - it.y) < 3 && /in\s*role/i.test(o.str)
        )
    );
    if (!header) continue;

    const headerY = header.y;
    const headerRow = items.filter((it) => Math.abs(it.y - headerY) < 3);
    const cols = [];
    for (const label of TABLE_COLUMN_LABELS) {
      const found = headerRow.find(
        (it) => it.str.trim().toLowerCase() === label.toLowerCase()
      );
      cols.push(found ? found.x : null);
    }
    const colStarts = cols.filter((x) => x !== null);
    if (colStarts.length < 3) continue;
    const colEnd = colStarts[colStarts.length - 1] + 100;

    const body = items
      .filter((it) => it.y < headerY - 3)
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const textLines = [];
    for (const it of body) {
      const last = textLines[textLines.length - 1];
      if (last && Math.abs(last.y - it.y) <= 2) last.items.push(it);
      else textLines.push({ y: it.y, items: [it] });
    }

    const rows = [];
    let currentRow = null;
    for (const tl of textLines) {
      if (currentRow && currentRow.y - tl.y <= 16) {
        currentRow.lines.push(tl);
      } else {
        currentRow = { y: tl.y, lines: [tl] };
        rows.push(currentRow);
      }
    }

    for (const row of rows) {
      const rowTop = row.lines[0].y;
      const cells = {};
      for (const tl of row.lines) {
        for (const it of tl.items) {
          let ci = -1;
          for (let i = 0; i < cols.length; i += 1) {
            const s = cols[i];
            if (s === null) continue;
            const e = cols[i + 1] !== undefined && cols[i + 1] !== null
              ? cols[i + 1]
              : colEnd;
            if (it.x >= s - 1 && it.x < e) {
              ci = i;
              break;
            }
          }
          if (ci < 0) continue;
          const key = TABLE_COLUMN_LABELS[ci];
          cells[key] = cells[key]
            ? `${cells[key]}${it.str}`
            : it.str;
        }
      }
      entryCount += 1;
      const rowBug = {
        title: (cells["Title"] || "").trim(),
        role: (cells["In Role"] || "").trim(),
        description: (cells["Description"] || "").trim(),
        reportedBy: (cells["Reported by"] || "").trim(),
        assignedTo: "",
        status: mapStatus(cells["Status"]),
      };
      const { bug, reason } = mapRow(rowBug);
      if (bug) {
        bug.page = p + 1;
        bug.rowTop = rowTop;
        bugs.push(bug);
      } else {
        skipped.push({ row: entryCount, reason });
      }
    }
  }

  return { bugs, skipped };
};

const assignScreenshots = async (buffer, bugs) => {
  if (!bugs.length) return;
  const images = await extractPdfImages(buffer);
  const byPage = new Map();
  for (const img of images) {
    if (!byPage.has(img.page)) byPage.set(img.page, []);
    byPage.get(img.page).push(img);
  }
  for (const imgList of byPage.values()) {
    imgList.sort((a, b) => a.top - b.top);
  }
  for (const bug of bugs) {
    const list = byPage.get(bug.page);
    if (!list || !list.length) continue;
    bug.screenshotDataUri = list.shift().dataUri;
  }
};

const parsePdf = async (buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const lines = result.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let resultBugs;
  if (detectTablePdf(lines)) {
    resultBugs = await parseTablePdf(buffer);
  } else if (lines.some((line) => PDF_HAS_LABEL_RE.test(line))) {
    resultBugs = parseLabeledPdf(lines);
  } else if (detectModuleFormat(lines)) {
    resultBugs = parseModulePdf(lines);
  } else {
    resultBugs = parseHeuristicPdf(lines);
  }

  await assignScreenshots(buffer, resultBugs.bugs);
  for (const bug of resultBugs.bugs) {
    delete bug.page;
    delete bug.rowTop;
  }
  return resultBugs;
};

const parseLabeledPdf = (lines) => {
  const bugs = [];
  const skipped = [];
  let current = null;
  let pendingField = null;
  let entryCount = 0;

  const assignPending = (value) => {
    if (!pendingField || !current) return;
    if (pendingField === "description") {
      current.description = current.description
        ? `${current.description}\n${value}`
        : value;
    } else if (!current[pendingField]) {
      current[pendingField] = value;
    }
  };

  const applyLabel = (field, match) => {
    const value = match[1].trim();
    if (value) {
      current[field] = value;
      pendingField = null;
    } else {
      pendingField = field;
    }
  };

  const flush = () => {
    if (!current) return;
    entryCount += 1;
    const { bug, reason } = mapRow(current);
    if (bug) bugs.push(bug);
    else skipped.push({ row: entryCount, reason });
    current = null;
    pendingField = null;
  };

  for (const line of lines) {
    if (PDF_NOISE_RE.some((rx) => rx.test(line))) continue;

    let m;
    if ((m = line.match(PDF_LABEL_RE.title))) {
      flush();
      current = emptyBug();
      applyLabel("title", m);
    } else if ((m = line.match(PDF_LABEL_RE.role))) {
      if (current) applyLabel("role", m);
    } else if ((m = line.match(PDF_LABEL_RE.description))) {
      if (current) applyLabel("description", m);
    } else if ((m = line.match(PDF_LABEL_RE.reportedBy))) {
      if (current) applyLabel("reportedBy", m);
    } else if ((m = line.match(PDF_LABEL_RE.assignedTo))) {
      if (current) applyLabel("assignedTo", m);
    } else if ((m = line.match(PDF_LABEL_RE.status))) {
      if (current) applyLabel("status", m);
    } else if (current) {
      if (pendingField) assignPending(line);
      else if (current.description) current.description += `\n${line}`;
      else current.description = line;
    }
  }
  flush();
  return { bugs, skipped };
};

const parseHeuristicPdf = (lines) => {
  const bugs = [];
  const skipped = [];
  let current = null;
  let entryCount = 0;

  const flush = () => {
    if (!current) return;
    entryCount += 1;
    if (!current.role) current.role = "General";
    if (!current.description) current.description = "No description provided";
    const { bug, reason } = mapRow(current);
    if (bug) bugs.push(bug);
    else skipped.push({ row: entryCount, reason });
    current = null;
  };

  const setField = (field, match) => {
    const value = (match[1] || "").trim();
    if (value) current[field] = value;
  };

  for (const line of lines) {
    if (PDF_NOISE_RE.some((rx) => rx.test(line))) continue;

    if (PDF_SECTION_RE.test(line)) {
      flush();
      current = emptyBug();
      const heading = line.replace(PDF_SECTION_RE, "").trim();
      current.title = heading || `Bug ${bugs.length + skipped.length + 1}`;
      continue;
    }

    if (!current) current = emptyBug();

    let m;
    if ((m = line.match(PDF_LABEL_RE.title))) {
      setField("title", m);
      continue;
    }
    if ((m = line.match(PDF_LABEL_RE.role))) {
      setField("role", m);
      continue;
    }
    if ((m = line.match(PDF_LABEL_RE.description))) {
      setField("description", m);
      continue;
    }
    if ((m = line.match(PDF_LABEL_RE.reportedBy))) {
      setField("reportedBy", m);
      continue;
    }
    if ((m = line.match(PDF_LABEL_RE.assignedTo))) {
      setField("assignedTo", m);
      continue;
    }
    if ((m = line.match(PDF_LABEL_RE.status))) {
      setField("status", m);
      continue;
    }

    if (!current.title && line.endsWith(":")) continue;

    if (!current.status && STATUS_KEYWORD_RE.test(line)) {
      current.status = mapStatus(line);
      continue;
    }
    if (!current.role && KNOWN_ROLES.has(line.toLowerCase())) {
      current.role =
        line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
      continue;
    }
    if (!current.reportedBy && line.includes("@") && line.length <= 60) {
      current.reportedBy = line;
      continue;
    }
    if (!current.title) {
      current.title = line;
      continue;
    }
    current.description = current.description
      ? `${current.description}\n${line}`
      : line;
  }
  flush();
  return { bugs, skipped };
};

export async function parseImportFile(buffer, filename) {
  const ext = path.extname(filename || "").toLowerCase();

  switch (ext) {
    case ".csv":
      return parseCsv(buffer);
    case ".xlsx":
      return parseExcel(buffer);
    case ".xls":
      throw new Error("Old .xls files are not supported; please save as .xlsx and retry");
    case ".docx":
      return parseDocx(buffer);
    case ".pptx":
      return parsePptx(buffer);
    case ".pdf":
      return parsePdf(buffer);
    default:
      throw new Error("Unsupported file type");
  }
}
