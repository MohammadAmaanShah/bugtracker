import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRef,
  PDFStream,
  PDFNumber,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";
import { encode as encodePng } from "fast-png";

function tokenize(bytes) {
  bytes = Buffer.from(bytes);
  const toks = [];
  let i = 0;
  const n = bytes.length;
  const isWs = (c) =>
    c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
  const isDelim = (c) => "()<>[]{}/%".includes(String.fromCharCode(c));

  while (i < n) {
    const c = bytes[i];
    if (isWs(c)) {
      i += 1;
      continue;
    }
    if (c === 37) {
      while (i < n && bytes[i] !== 10 && bytes[i] !== 13) i += 1;
      continue;
    }
    if (c === 47) {
      let j = i + 1;
      while (j < n && !isWs(bytes[j]) && !isDelim(bytes[j])) j += 1;
      toks.push({ type: "name", value: bytes.slice(i + 1, j).toString("latin1") });
      i = j;
      continue;
    }
    if (c === 40) {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        const cc = bytes[j];
        if (cc === 92) {
          j += 2;
          continue;
        }
        if (cc === 40) depth += 1;
        else if (cc === 41) depth -= 1;
        j += 1;
      }
      toks.push({ type: "str", value: null });
      i = j;
      continue;
    }
    if (c === 60 && bytes[i + 1] !== 60) {
      let j = i + 1;
      while (j < n && bytes[j] !== 62) j += 1;
      toks.push({ type: "str", value: null });
      i = j + 1;
      continue;
    }
    if (c === 91) {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (bytes[j] === 91) depth += 1;
        else if (bytes[j] === 93) depth -= 1;
        j += 1;
      }
      toks.push({ type: "array", value: null });
      i = j;
      continue;
    }
    const ch = String.fromCharCode(c);
    if (ch === "+" || ch === "-" || ch === "." || (c >= 48 && c <= 57)) {
      let j = i;
      let m = "";
      while (
        j < n &&
        (bytes[j] === 45 ||
          bytes[j] === 43 ||
          bytes[j] === 46 ||
          (bytes[j] >= 48 && bytes[j] <= 57) ||
          bytes[j] === 101 ||
          bytes[j] === 69)
      ) {
        m += String.fromCharCode(bytes[j]);
        j += 1;
      }
      toks.push({ type: "num", value: parseFloat(m) });
      i = j;
      continue;
    }
    if (isDelim(c) && ch !== "/" && ch !== "[") {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !isWs(bytes[j]) && !isDelim(bytes[j])) j += 1;
    toks.push({ type: "op", value: bytes.slice(i, j).toString("latin1") });
    i = j;
  }
  return toks;
}

export function parseImagePaints(page, height) {
  const contents = page.node.Contents();
  if (!contents) return [];
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
  const res = page.node.Resources();
  const xobj = res ? res.lookupMaybe(PDFName.of("XObject"), PDFDict) : undefined;
  if (!xobj) return [];

  const paints = [];
  let operands = [];
  const stack = [];
  let ctm = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const mul = (m, t) => ({
    a: m.a * t.a + m.c * t.b,
    b: m.b * t.a + m.d * t.b,
    c: m.a * t.c + m.c * t.d,
    d: m.b * t.c + m.d * t.d,
    e: m.a * t.e + m.c * t.f + m.e,
    f: m.b * t.e + m.d * t.f + m.f,
  });

  for (const stream of streams) {
    if (!(stream instanceof PDFStream)) continue;
    let decoded;
    try {
      decoded = decodePDFRawStream(stream).decode();
    } catch {
      continue;
    }
    for (const tok of tokenize(decoded)) {
      if (tok.type === "num" || tok.type === "name") {
        operands.push(tok.value);
      } else if (tok.type === "op") {
        const op = tok.value;
        if (op === "cm" && operands.length >= 6) {
          const n = operands.length;
          ctm = mul(ctm, {
            a: operands[n - 6],
            b: operands[n - 5],
            c: operands[n - 4],
            d: operands[n - 3],
            e: operands[n - 2],
            f: operands[n - 1],
          });
        } else if (op === "q") {
          stack.push(ctm);
        } else if (op === "Q") {
          ctm = stack.pop() || ctm;
        } else if (op === "Do") {
          const name = operands[operands.length - 1];
          if (typeof name === "string" && xobj.has(PDFName.of(name))) {
            const y0 = ctm.f;
            const y1 = ctm.f + ctm.d;
            paints.push({
              name,
              top: height - Math.max(y0, y1),
              bottom: height - Math.min(y0, y1),
            });
          }
        }
        operands = [];
      } else {
        operands = [];
      }
    }
  }
  return paints;
}

function colorSpaceComponents(page, colorSpace) {
  const context = page.node.context;
  if (colorSpace instanceof PDFName) {
    const cs = colorSpace.decodeText();
    if (cs === "DeviceRGB" || cs === "RGB") return 3;
    if (cs === "DeviceCMYK" || cs === "CMYK") return 4;
    if (cs === "DeviceGray" || cs === "G") return 1;
    return null;
  }
  if (colorSpace instanceof PDFArray) {
    const arr = colorSpace.asArray();
    const kind = arr[0] instanceof PDFName ? arr[0].decodeText() : "";
    if (kind === "ICCBased") {
      const icc = context.lookup(arr[1]);
      if (icc instanceof PDFStream) {
        const n = icc.dict.lookupMaybe(PDFName.of("N"), PDFNumber);
        if (n) return n.asNumber();
      }
      return null;
    }
    if (kind === "Indexed" || kind === "I") {
      return colorSpaceComponents(page, arr[1]);
    }
    if (kind === "Separation" || kind === "DeviceN") return 1;
    if (kind === "CalRGB" || kind === "Lab") return 3;
    if (kind === "CalGray") return 1;
  }
  return null;
}

function unfilterPngScanlines(data, width, colors, bpc) {
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bpc) / 8));
  const stride = width * bytesPerPixel;
  const out = new Uint8Array(data.length);
  for (let y = 0; y * (stride + 1) < data.length; y += 1) {
    const src = y * (stride + 1);
    const dst = y * stride;
    const ft = data[src];
    for (let i = 0; i < stride; i += 1) {
      const x = i - bytesPerPixel;
      const left = x >= 0 ? out[dst + x] : 0;
      const up = y > 0 ? out[dst - stride + i] : 0;
      const upLeft = y > 0 && x >= 0 ? out[dst - stride + x] : 0;
      let v = data[src + 1 + i];
      switch (ft) {
        case 0:
          break;
        case 1:
          v = (v + left) & 255;
          break;
        case 2:
          v = (v + up) & 255;
          break;
        case 3:
          v = (v + ((left + up) >> 1)) & 255;
          break;
        default: {
          const pa = Math.abs(up - upLeft);
          const pb = Math.abs(left - upLeft);
          const pc = Math.abs(left + up - 2 * upLeft);
          const p = pa <= pb && pa <= pc ? upLeft : pb <= pc ? left : up;
          v = (v + p) & 255;
          break;
        }
      }
      out[dst + i] = v;
    }
  }
  return out;
}

function rasterToPng(width, height, components, data) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const off = i * components;
    let r;
    let g;
    let b;
    if (components === 1) {
      r = g = b = data[off];
    } else if (components === 3) {
      r = data[off];
      g = data[off + 1];
      b = data[off + 2];
    } else if (components === 4) {
      const c = data[off] / 255;
      const m = data[off + 1] / 255;
      const y = data[off + 2] / 255;
      const k = data[off + 3] / 255;
      r = 255 * (1 - Math.min(1, c * (1 - k) + k));
      g = 255 * (1 - Math.min(1, m * (1 - k) + k));
      b = 255 * (1 - Math.min(1, y * (1 - k) + k));
    } else {
      r = g = b = 0;
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodePng({ width, height, data: rgba });
}

function decodeImageRaster(imgObj, width, height, components) {
  const bits = imgObj.dict.lookupMaybe(PDFName.of("BitsPerComponent"), PDFNumber);
  const bpc = bits ? bits.asNumber() : 8;
  if (bpc !== 8) return null;

  let decoded;
  try {
    decoded = decodePDFRawStream(imgObj).decode();
  } catch {
    return null;
  }

  const dp = imgObj.dict.lookupMaybe(PDFName.of("DecodeParms"));
  let predictor = null;
  let colors = components;
  if (dp instanceof PDFDict) {
    predictor =
      dp.lookupMaybe(PDFName.of("Predictor"), PDFNumber)?.asNumber() || null;
    colors = dp.lookupMaybe(PDFName.of("Colors"), PDFNumber)?.asNumber() || components;
  } else if (dp instanceof PDFArray) {
    const first = dp.get(0);
    if (first instanceof PDFDict) {
      predictor =
        first.lookupMaybe(PDFName.of("Predictor"), PDFNumber)?.asNumber() || null;
      colors =
        first.lookupMaybe(PDFName.of("Colors"), PDFNumber)?.asNumber() || components;
    }
  }

  const expected = width * height * colors;
  if (decoded.length < expected) return null;

  let raster = decoded;
  if (predictor && predictor >= 10) {
    raster = unfilterPngScanlines(decoded.slice(0, expected + height), width, colors, bpc);
  }
  return { data: raster, colors };
}

async function imageToDataUri(page, imgObj, width, height, components) {
  const decoded = decodeImageRaster(imgObj, width, height, components);
  if (!decoded) return null;
  const png = rasterToPng(width, height, decoded.colors, decoded.data);
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

export async function extractPdfImages(buffer) {
  const doc = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const images = [];

  for (let p = 0; p < doc.getPageCount(); p += 1) {
    const page = doc.getPage(p);
    const height = page.getHeight();
    const res = page.node.Resources();
    const xobj = res ? res.lookupMaybe(PDFName.of("XObject"), PDFDict) : undefined;
    if (!xobj) continue;

    const paints = parseImagePaints(page, height);
    for (const paint of paints) {
      const imgRef = xobj.lookupMaybe(PDFName.of(paint.name), PDFStream);
      if (!imgRef) continue;
      const w = imgRef.dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber();
      const h = imgRef.dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber();
      if (!w || !h || w * h > 40e6) continue;

      const cs = imgRef.dict.get(PDFName.of("ColorSpace"));
      const components = colorSpaceComponents(page, cs);
      if (!components || components < 1 || components > 4) continue;

      const dataUri = await imageToDataUri(page, imgRef, w, h, components);
      if (dataUri) {
        images.push({
          page: p + 1,
          top: paint.top,
          bottom: paint.bottom,
          width: w,
          height: h,
          dataUri,
        });
      }
    }
  }

  return images;
}
