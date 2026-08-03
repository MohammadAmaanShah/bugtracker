import mongoose from "mongoose";

let bucket;

export function getGridFSBucket() {
  if (!bucket) {
    const db = mongoose.connection.db;
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "screenshots" });
  }
  return bucket;
}

export function isGridFsId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || ""));
}

export function saveScreenshot(buffer, { filename, contentType }) {
  return new Promise((resolve, reject) => {
    const stream = getGridFSBucket().openUploadStream(
      filename || "screenshot.png",
      { contentType: contentType || "application/octet-stream" }
    );
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id.toString()));
    stream.end(buffer);
  });
}

export async function deleteScreenshot(value) {
  const id = String(value || "");
  if (!isGridFsId(id)) return;
  try {
    await getGridFSBucket().delete(new mongoose.Types.ObjectId(id));
  } catch {
    // already gone
  }
}
