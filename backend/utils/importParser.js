import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import JSZip from "jszip";
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
  if (key === "fixed" || key === "closed" || key === "done") return "fixed";
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
    default:
      throw new Error("Unsupported file type");
  }
}
