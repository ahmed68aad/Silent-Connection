import express from "express";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import auth from "../middleWares/auth.js";
import crypto from "crypto";
import { hasMailConfig, sendVerificationEmail } from "../config/mailer.js";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import { profileImageUpload } from "../config/multer.js";

const UserRouter = express.Router();
const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;

const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const generateUniqueInviteCode = async () => {
  let inviteCode = generateInviteCode();
  let exists = await User.findOne({ inviteCode });

  while (exists) {
    inviteCode = generateInviteCode();
    exists = await User.findOne({ inviteCode });
  }

  return inviteCode;
};

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  profileImage: user.profileImage || "",
  inviteCode: user.inviteCode,
  coupleId: user.coupleId,
  emailVerified: user.emailVerified !== false,
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
});

const getProfileImageUrl = (file) => {
  if (file.filename) return `/uploads/profiles/${file.filename}`;
  if (file.path) return file.path;
  if (file.buffer) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }

  const error = new Error("Uploaded profile image could not be read");
  error.statusCode = 400;
  throw error;
};

const createToken = (id) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 503;
    error.publicMessage = "Authentication is not configured yet";
    throw error;
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeEmail = (email) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const dbName = mongoose.connection.db?.databaseName;
  console.log(`[Auth] Searching for: "${normalizedEmail}" in DB: "${dbName}"`);

  const directUser = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );
  if (directUser) {
    return directUser;
  }

  return await User.findOne({
    email: {
      $regex: `^\\s*${escapeRegExp(normalizedEmail)}\\s*$`,
      $options: "i",
    },
  }).select("+password");
};

const hashEmailVerificationCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const createEmailVerificationCode = () => {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashEmailVerificationCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return { code, codeHash, expiresAt };
};

export const ensureDbConnected = async (request, response, next) => {
  try {
    // Always allow OPTIONS requests to pass through to the CORS middleware
    if (request.method === "OPTIONS") {
      return next();
    }

    await connectDB();
    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({
        success: false,
        message:
          "Database connection is not ready. Please try again in a moment.",
      });
    }

    const dbName = mongoose.connection.db?.databaseName;
    if (dbName === "test") {
      console.error(
        '[Database] ERROR: You are connected to "test". Please update MONGO_URI in .env to include "/silent"',
      );
    }

    next();
  } catch (error) {
    console.error("[Database] Connection Middleware Error:", error);
    next(error);
  }
};

UserRouter.use(
  ["/register", "/login", "/verify-email", "/resend-verification"],
  ensureDbConnected,
);

const queueVerificationEmail = async (user) => {
  const { code, codeHash, expiresAt } = createEmailVerificationCode();

  console.log("[Auth] Queueing verification email", {
    userId: user._id.toString(),
    email: user.email,
  });

  user.emailVerificationCodeHash = codeHash;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  if (!hasMailConfig) {
    const error = new Error("Email service is not configured");
    error.statusCode = 503;
    error.publicMessage =
      "Verification emails are currently unavailable. Please contact support.";
    throw error;
  }

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationCode: code,
    });
    console.log("[Auth] Verification email queued successfully", {
      userId: user._id.toString(),
      email: user.email,
    });
  } catch (error) {
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();
    error.statusCode = error.statusCode || 502;
    error.publicMessage =
      error.publicMessage ||
      "Could not send the verification email. Check your SMTP configuration.";
    throw error;
  }
};

UserRouter.post("/register", async (request, response) => {
  const { name, password, email } = request.body;
  try {
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = name?.trim();

    if (!trimmedName || !normalizedEmail || !password) {
      return response.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check if the user exists
    const exist = await findUserByEmail(normalizedEmail);
    if (exist) {
      if (exist.emailVerified === false) {
        if (!hasMailConfig) {
          return response.status(503).json({
            success: false,
            message:
              "Email sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to server/.env.",
          });
        }

        await queueVerificationEmail(exist);
        return response.json({
          success: true,
          user: sanitizeUser(exist),
          message:
            "Account already exists. A new verification code has been sent.",
        });
      }

      return response.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Validate email
    if (!validator.isEmail(normalizedEmail)) {
      return response.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    // Validate password
    if (password.length < 8) {
      return response.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (!hasMailConfig) {
      return response.status(503).json({
        success: false,
        message:
          "Email sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to server/.env.",
      });
    }

    // Hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save new user
    const newUser = new User({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      inviteCode: await generateUniqueInviteCode(),
      emailVerified: false,
      emailVerifiedAt: null,
    });

    const user = await newUser.save();

    try {
      await queueVerificationEmail(user);
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    return response.json({
      success: true,
      user: sanitizeUser(user),
      message:
        "Account created. Enter the verification code sent to your email.",
    });
  } catch (error) {
    console.log(error);

    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.publicMessage || error.message,
      });
    }

    // Send error response
    return response.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
});

UserRouter.post("/login", async (request, response) => {
  const { email, password } = request.body;
  try {
    if (!email || !password) {
      return response.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return response.status(404).json({
        success: false,
        message: "User does not exist",
      });
    }

    if (!user.password) {
      console.error(`[Auth] User found but has no password field: ${email}`);
      return response.status(400).json({
        success: false,
        message: "Account record is incomplete (missing password).",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return response.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.emailVerified === false) {
      return response.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in",
      });
    }

    const token = createToken(user._id.toString());

    response.json({ success: true, token, user: sanitizeUser(user) });
  } catch (error) {
    console.error("Login Error:", error);
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.publicMessage || error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
});

UserRouter.post("/resend-verification", async (request, response) => {
  const { email } = request.body;

  try {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
      return response.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    const genericResponse = {
      success: true,
      message: "If this account needs verification, a new code has been sent.",
    };

    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      console.log("[Auth] Resend verification skipped: user not found", {
        email: normalizedEmail,
      });
      return response.json(genericResponse);
    }

    if (user.emailVerified) {
      console.log("[Auth] Resend verification skipped: already verified", {
        userId: user._id.toString(),
        email: user.email,
      });
      return response.json(genericResponse);
    }

    if (!hasMailConfig) {
      return response.status(503).json({
        success: false,
        message:
          "Email sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS to server/.env.",
      });
    }

    await queueVerificationEmail(user);
    return response.json(genericResponse);
  } catch (error) {
    console.error("Resend verification error:", error);
    return response.status(error.statusCode || 500).json({
      success: false,
      message: error.publicMessage || "Failed to resend verification email",
    });
  }
});

UserRouter.post("/verify-email", async (request, response) => {
  const { email, code } = request.body;

  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code || "").trim();
    if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
      return response.status(400).json({
        success: false,
        message: "Please enter a valid email",
      });
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      return response.status(400).json({
        success: false,
        message: "Please enter the 6-digit verification code",
      });
    }

    const codeHash = hashEmailVerificationCode(normalizedCode);
    const user = await User.findOne({
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: { $gt: new Date() },
    });

    if (!user || user.email.toLowerCase() !== normalizedEmail) {
      return response.status(400).json({
        success: false,
        message: "Verification code is invalid or expired",
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    const authToken = createToken(user._id.toString());

    return response.json({
      success: true,
      token: authToken,
      user: sanitizeUser(user),
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.log(error);
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.publicMessage || error.message,
      });
    }

    return response.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
});

UserRouter.get("/me", auth, async (request, response) => {
  return response.json({
    success: true,
    user: sanitizeUser(request.user),
  });
});

UserRouter.post(
  "/profile-image",
  auth,
  profileImageUpload.single("profileImage"),
  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          success: false,
          message: "Profile image is required",
        });
      }

      if (request.file.size && request.file.size > MAX_PROFILE_IMAGE_SIZE) {
        return response.status(400).json({
          success: false,
          message: "Profile image must be 2MB or less",
        });
      }

      const profileImage = getProfileImageUrl(request.file);

      request.user.profileImage = profileImage;
      await request.user.save();

      return response.json({
        success: true,
        user: sanitizeUser(request.user),
        message: "Profile image updated",
      });
    } catch (error) {
      console.log(error);
      return response.status(500).json({
        success: false,
        message: "Failed to update profile image",
      });
    }
  },
);

export default UserRouter;
