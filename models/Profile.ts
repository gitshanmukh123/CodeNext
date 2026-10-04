import mongoose, { Schema, Document } from "mongoose";

export interface IProfile extends Document {
  codeforcesUsername: string;
  leetcodeUsername: string;
  codeforcesRating: number;
  codeforcesMaxRating: number;
  codeforcesRank: string;
  leetcodeTotalSolved: number;
  leetcodeEasySolved: number;
  leetcodeMediumSolved: number;
  leetcodeHardSolved: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    codeforcesUsername: { type: String, required: true, lowercase: true, trim: true },
    leetcodeUsername: { type: String, required: true, lowercase: true, trim: true },
    codeforcesRating: { type: Number, default: 0 },
    codeforcesMaxRating: { type: Number, default: 0 },
    codeforcesRank: { type: String, default: "" },
    leetcodeTotalSolved: { type: Number, default: 0 },
    leetcodeEasySolved: { type: Number, default: 0 },
    leetcodeMediumSolved: { type: Number, default: 0 },
    leetcodeHardSolved: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProfileSchema.index({ codeforcesUsername: 1, leetcodeUsername: 1 }, { unique: true });

export default mongoose.models.Profile || mongoose.model<IProfile>("Profile", ProfileSchema);
