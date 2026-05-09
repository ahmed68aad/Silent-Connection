import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    coupleId: {
      type: String,
      default: null,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationCodeHash: {
      type: String,
      default: null,
      index: true,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", UserSchema);
