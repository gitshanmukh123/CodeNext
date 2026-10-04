import mongoose, { Schema, Document } from "mongoose";

export interface IRecommendation extends Document {
  profileId: string;
  problemExternalId: string;
  platform: string;
  score: number;
  reason: string;
  concept: string;
  type: string;
  createdAt: Date;
}

const RecommendationSchema = new Schema<IRecommendation>(
  {
    profileId: { type: String, required: true, index: true },
    problemExternalId: { type: String, required: true },
    platform: { type: String, required: true },
    score: { type: Number, required: true },
    reason: { type: String, required: true },
    concept: { type: String, required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

RecommendationSchema.index({ profileId: 1, score: -1 });

export default mongoose.models.Recommendation ||
  mongoose.model<IRecommendation>("Recommendation", RecommendationSchema);
