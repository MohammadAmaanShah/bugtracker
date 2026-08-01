import mongoose from "mongoose";

const editEntrySchema = new mongoose.Schema(
  {
    editedBy: {
      type: String,
      trim: true,
      default: "Unknown",
    },
    field: {
      type: String,
      required: true,
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

const bugSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 5000,
    },
    screenshot: {
      type: String,
      default: null,
    },
    reportedBy: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTo: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["in_progress", "fixed"],
      default: "in_progress",
    },
    editHistory: {
      type: [editEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Bug", bugSchema);
