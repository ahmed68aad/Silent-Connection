import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = req.headers.token;

    if (!authHeader && !headerToken) {
      return res.status(401).json({
        success: false,
        message: "No token, please login",
      });
    }

    let token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!token && authHeader) {
      const [scheme, bearerToken] = authHeader.split(" ");
      if (scheme === "Bearer") {
        token = bearerToken;
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token header",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export default authMiddleware;
