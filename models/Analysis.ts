import mongoose, { Schema, Document } from "mongoose";

export interface IAnalysis extends Document {
  profileId: string;
  concept: string;
  category: string;
  solvedCount: number;
  attemptedCount: number;
  successRate: number;
  averageDifficulty: number;
  averageAttempts: number;
  recentActivity: string | null;
  masteryScore: number;
  status: string;
  codeforcesSolved: number;
  leetcodeSolved: number;
  createdAt: Date;
}

const AnalysisSchema = new Schema<IAnalysis>(
  {
    profileId: { type: String, required: true, index: true },
    concept: { type: String, required: true },
    category: { type: String, required: true },
    solvedCount: { type: Number, default: 0 },
    attemptedCount: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    averageDifficulty: { type: Number, default: 0 },
    averageAttempts: { type: Number, default: 1 },
    recentActivity: { type: String, default: null },
    masteryScore: { type: Number, default: 0 },
    status: { type: String, default: "Unexplored" },
    codeforcesSolved: { type: Number, default: 0 },
    leetcodeSolved: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AnalysisSchema.index({ profileId: 1, concept: 1 }, { unique: true });

export default mongoose.models.Analysis || mongoose.model<IAnalysis>("Analysis", AnalysisSchema);
