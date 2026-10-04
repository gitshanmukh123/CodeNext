import mongoose, { Schema, Document } from "mongoose";

export interface ISubmission extends Document {
  profileId: string;
  platform: "codeforces" | "leetcode";
  problemExternalId: string;
  verdict: string;
  submittedAt: Date;
  language?: string;
  contestId?: number;
  timeSeconds?: number;
  memoryBytes?: number;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    profileId: { type: String, required: true, index: true },
    platform: { type: String, required: true, enum: ["codeforces", "leetcode"] },
    problemExternalId: { type: String, required: true },
    verdict: { type: String, required: true },
    submittedAt: { type: Date, required: true },
    language: { type: String },
    contestId: { type: Number },
    timeSeconds: { type: Number },
    memoryBytes: { type: Number },
  },
  { timestamps: false }
);

SubmissionSchema.index({ profileId: 1, platform: 1, problemExternalId: 1 });

export default mongoose.models.Submission || mongoose.model<ISubmission>("Submission", SubmissionSchema);
