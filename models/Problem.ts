import mongoose, { Schema, Document } from "mongoose";

export interface IProblem extends Document {
  platform: "codeforces" | "leetcode";
  externalId: string;
  title: string;
  url: string;
  difficulty?: string;
  rating?: number;
  tags: string[];
  concepts: string[];
  aiClassified: boolean;
}

const ProblemSchema = new Schema<IProblem>(
  {
    platform: { type: String, required: true, enum: ["codeforces", "leetcode"] },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    difficulty: { type: String },
    rating: { type: Number },
    tags: [{ type: String }],
    concepts: [{ type: String }],
    aiClassified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ProblemSchema.index({ platform: 1, externalId: 1 }, { unique: true });

export default mongoose.models.Problem || mongoose.model<IProblem>("Problem", ProblemSchema);
