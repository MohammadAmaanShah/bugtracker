import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export async function nextBugNumber() {
  const doc = await Counter.findOneAndUpdate(
    { _id: "bug_number" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}

export async function getBugCounter() {
  const doc = await Counter.findOne({ _id: "bug_number" });
  return doc ? doc.seq : 0;
}

export async function setBugCounter(seq) {
  await Counter.findOneAndUpdate(
    { _id: "bug_number" },
    { $set: { seq } },
    { upsert: true }
  );
}
