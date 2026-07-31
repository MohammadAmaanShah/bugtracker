import mongoose from "mongoose";

const actionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["created", "status", "deleted"],
      required: true,
    },
    actor: {
      type: String,
      trim: true,
      required: true,
    },
    bugId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bug",
    },
    bugTitle: {
      type: String,
      trim: true,
      default: "",
    },
    oldValue: {
      type: String,
      default: null,
    },
    newValue: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Action", actionSchema);
