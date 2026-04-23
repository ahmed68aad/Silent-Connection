import express from "express";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import auth from "../middleWares/auth.js";
import crypto from "crypto";
import { hasMailConfig, sendVerificationEmail } from "../config/mailer.js";
import { profileImageUpload } from "../config/multer.js";
import { authLimiter, emailLimiter, uploadLimiter } from "../middleWares/rateLimit.js";

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

const createToken = (id) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 503;
    error.publicMessage = "Authentication is not configured yet";
    throw error;
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const hashEmailVerificationCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

const createEmailVerificationCode = () => {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashEmailVerificationCode(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return { code, codeHash, expiresAt };
};

const queueVerificationEmail = async (user) => {
  const { code, codeHash, expiresAt } = createEmailVerificationCode();

  user.emailVerificationCodeHash = codeHash;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationCode: code,
    });
  } catch (error) {
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();
    error.statusCode = error.statusCode || 502;
    error.publicMessage =
      error.publicMessage || "Could not send the verification email. Check SMTP settings.";
    throw error;
  }
};

UserRouter.post("/register", authLimiter, async (request, response) => {
  const { name, password, email } = request.body;
  try {
    const normalizedEmail = email?.trim().toLowerCase();
    const trimmedName = name?.trim();

    if (!trimmedName || !normalizedEmail || !password) {
      return response.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    // Check if the user exists
    const exist = await User.findOne({ email: normalizedEmail });
    if (exist) {
      if (exist.emailVerified === false) {
        if (!hasMailConfig) {
          return response.status(503).json({
            success: false,
            message: "Email verification is not configured yet",
          });
        }

        await queueVerificationEmail(exist);
        return response.json({
          success: true,
          user: sanitizeUser(exist),
          message: "Account already exists. A new verification code has been sent.",
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
        message: "Email verification is not configured yet",
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
      message: "Account created. Enter the verification code sent to your email.",
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

UserRouter.post("/login", authLimiter, async (request, response) => {
  const { email, password } = request.body;
  try {
    if (!email || !password) {
      return response.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return response.status(404).json({
        success: false,
        message: "User does not exist",
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

    const token = createToken(user._id);

    response.json({ success: true, token, user: sanitizeUser(user) });
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
      message: "Failed to login",
    });
  }
});

UserRouter.post("/resend-verification", emailLimiter, async (request, response) => {
  const { email } = request.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();

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

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.emailVerified) {
      return response.json(genericResponse);
    }

    if (!hasMailConfig) {
      return response.status(503).json({
        success: false,
        message: "Email verification is not configured yet",
      });
    }

    await queueVerificationEmail(user);
    return response.json(genericResponse);
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
});

UserRouter.post("/verify-email", emailLimiter, async (request, response) => {
  const { email, code } = request.body;

  try {
    const normalizedEmail = email?.trim().toLowerCase();
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
      email: normalizedEmail,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: { $gt: new Date() },
    });

    if (!user) {
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

    const authToken = createToken(user._id);

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
  uploadLimiter,
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

      const profileImage =
        request.file.path ||
        `data:${request.file.mimetype};base64,${request.file.buffer.toString("base64")}`;

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
