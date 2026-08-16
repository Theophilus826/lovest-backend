
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const User = require("../model/UserModel");

/* =========================================================
   EXTRACT TOKEN
========================================================= */

const getTokenFromRequest = (req) => {
  // -------------------------------------------------------
  // 1. HTTP-only cookie
  // -------------------------------------------------------
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  // -------------------------------------------------------
  // 2. Authorization: Bearer <token>
  // -------------------------------------------------------
  const authorization = req.headers.authorization;

  if (
    authorization &&
    authorization.startsWith("Bearer ")
  ) {
    const token = authorization.substring(7).trim();

    if (token) {
      return token;
    }
  }

  // -------------------------------------------------------
  // 3. SSE / EventSource token
  // -------------------------------------------------------
  if (req.query?.token) {
    return String(req.query.token);
  }

  return null;
};

/* =========================================================
   PROTECT
   Authenticate the user using JWT
========================================================= */

const protect = asyncHandler(async (req, res, next) => {
  const token = getTokenFromRequest(req);

  // -------------------------------------------------------
  // No token
  // -------------------------------------------------------

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    });
  }

  try {
    // -----------------------------------------------------
    // Verify JWT
    // -----------------------------------------------------

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // -----------------------------------------------------
    // Get user ID
    //
    // Your generateToken() currently creates:
    // { id: userId }
    //
    // We also support _id for compatibility.
    // -----------------------------------------------------

    const userId = decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    
    const user = await User.findById(userId).select(
      "-password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // -----------------------------------------------------
    // Attach user to request
    // -----------------------------------------------------

    req.user = user;

    // -----------------------------------------------------
    // Development logging
    // -----------------------------------------------------

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "AUTH USER:",
        user._id.toString(),
        "| isAdmin:",
        user.isAdmin === true
      );
    }

    next();
  } catch (error) {
    // -----------------------------------------------------
    // JWT errors
    // -----------------------------------------------------

    console.error(
      "AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Token failed",
    });
  }
});

/* =========================================================
   ADMIN
   Only users with isAdmin === true can continue.
========================================================= */

const admin = (req, res, next) => {
  // -------------------------------------------------------
  // User must already be authenticated by protect
  // -------------------------------------------------------

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }

  // -------------------------------------------------------
  // Check administrator permission
  //
  // IMPORTANT:
  // Use strict === true so only an actual boolean true
  // grants administrator access.
  // -------------------------------------------------------

  if (req.user.isAdmin === true) {
    return next();
  }

  // -------------------------------------------------------
  // Authenticated but not an administrator
  // -------------------------------------------------------

  return res.status(403).json({
    success: false,
    message: "Admin access only",
  });
};

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  protect,
  admin,
};

