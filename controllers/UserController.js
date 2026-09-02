const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { formatPhone, hashPhone } = require("../config/phone");

const User = require("../model/UserModel");
// or the correct relative path

/* ================= TOKEN ================= */
const generateToken = (id, expiresIn = "7d") => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

/* ================= REGISTER ================= */
const registerUser = asyncHandler(async (req, res) => {
  let {
    name,
    email,
    phone,
    password,
    confirmPassword,
    referralCode, // referral code from signup form
  } = req.body;

  if (!name || !password || !confirmPassword) {
    res.status(400);
    throw new Error("Required fields missing");
  }

  if (password !== confirmPassword) {
    res.status(400);
    throw new Error("Passwords do not match");
  }

  email = email?.toLowerCase().trim();

  const rawPhone = phone?.trim();
  phone = rawPhone ? formatPhone(rawPhone) : undefined;

  if (!email && !phone) {
    res.status(400);
    throw new Error("Provide email or phone");
  }

  if (rawPhone && !phone) {
    res.status(400);
    throw new Error("Invalid phone number");
  }

  const orQuery = [];

  if (email) orQuery.push({ email });
  if (phone) orQuery.push({ phone });

  const existingUser = await User.findOne({ $or: orQuery });

  if (existingUser) {
    res.status(400);
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  /* Generate unique referral code for this new user */
  let myReferralCode;
  let exists = true;

  while (exists) {
    myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    exists = await User.findOne({
      referralCode: myReferralCode,
    });
  }

  const userData = {
    name,
    password: hashedPassword,
    isVerified: true,
    online: true,
    referralCode: myReferralCode,
  };

  if (email) userData.email = email;
  if (phone) userData.phone = phone;

  const user = await User.create(userData);

  /* Save referral if a referral code was supplied */
  if (referralCode) {
    await handleReferral(user._id, referralCode);
  }

  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    avatar: user.avatar || null,
    referralCode: user.referralCode,
    coins: user.coins,
    isAdmin: user.isAdmin,
    token,
    message: "Registration successful",
  });
});

/* ================= LOGIN ================= */
const loginUser = asyncHandler(async (req, res) => {
  let { identifier, password } = req.body;

  if (!identifier || !password) {
    res.status(400);
    throw new Error("Identifier and password required");
  }

  identifier = identifier.trim();

  const formattedPhone = formatPhone(identifier);

  const email = identifier.includes("@") ? identifier.toLowerCase() : null;

  const user = await User.findOne({
    $or: [
      ...(email ? [{ email }] : []),
      ...(formattedPhone ? [{ phone: formattedPhone }] : []),
    ],
  });

  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const matched = await bcrypt.compare(password, user.password);

  if (!matched) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  user.online = true;
  user.lastActive = Date.now();

  // Do not hold the login response open for this presence update.
  user.save().catch((error) => {
    console.error("Failed to update user presence:", error.message);
  });

  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    avatar: user.avatar || null,
    isAdmin: user.isAdmin,
    token,
  });
});

/* ================= LOGOUT ================= */
const logoutUser = asyncHandler(async (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.json({
    message: "Logged out successfully",
  });
});

/* ================= GET SINGLE USER ================= */
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select(
    "_id name avatar online lastActive",
  );

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      avatar: user.avatar || null,
      status: user.online ? "online" : "offline",
      lastActive: user.lastActive,
    },
  });
});

/* ================= FORGOT PASSWORD ================= */
const forgotPassword = asyncHandler(async (req, res) => {
  let { identifier } = req.body;

  if (!identifier) {
    res.status(400);
    throw new Error("Identifier (email or phone) required");
  }

  identifier = String(identifier).trim();

  const isEmail = identifier.includes("@");

  const formattedPhone = isEmail ? null : formatPhone(identifier);

  const user = await User.findOne({
    $or: [
      ...(isEmail ? [{ email: identifier.toLowerCase() }] : []),
      ...(formattedPhone ? [{ phone: formattedPhone }] : []),
    ],
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  await user.save();

  res.json({
    message: "Reset token generated",
    resetToken,
  });
});

/* ================= RESET PASSWORD ================= */
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const { password } = req.body;

  if (!token) {
    res.status(400);
    throw new Error("Reset token required");
  }

  if (!password || !String(password).trim()) {
    res.status(400);
    throw new Error("Password required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: {
      $gt: Date.now(),
    },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired token");
  }

  user.password = await bcrypt.hash(password, 10);

  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.json({
    message: "Password reset successful",
  });
});

/* ================= VERIFY PHONE ================= */
const verifyPhone = asyncHandler(async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    res.status(400);
    throw new Error("userId and code required");
  }

  const hashed = crypto.createHash("sha256").update(String(code)).digest("hex");

  const user = await User.findOne({
    _id: userId,
    phoneVerificationToken: hashed,
    phoneVerificationExpire: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired verification code");
  }

  user.isVerified = true;
  user.phoneVerificationToken = undefined;
  user.phoneVerificationExpire = undefined;

  await user.save();

  // Issue auth token after verification
  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    message: "Phone verified",
    token,
  });
});

/* ================= WELCOME ================= */
const welcome = asyncHandler(async (req, res) => {
  res.json({
    message: `Good ${getTimeOfDay()}, ${req.user.name}!`,
  });
});

function getTimeOfDay() {
  const hour = new Date().getHours();

  if (hour < 12) return "Morning";

  if (hour < 18) return "Afternoon";

  return "Evening";
}

/* =========================
   GET ALL USERS (ADMIN ONLY)
========================= */

const getAllUsers = asyncHandler(async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }

  // ==========================================
  // DATABASE DEBUG
  // ==========================================

  console.log("\n=================================");
  console.log("ADMIN USERS DEBUG");
  console.log("=================================");

  console.log(
    "MongoDB database:",
    User.db.name
  );

  console.log(
    "MongoDB collection:",
    User.collection.name
  );

  console.log(
    "Authenticated user:",
    req.user._id.toString()
  );

  console.log(
    "Authenticated user isAdmin:",
    req.user.isAdmin
  );

  // ==========================================
  // FIND AUTHENTICATED USER
  // ==========================================

  const authenticatedUser = await User.findById(
    req.user._id
  ).lean();

  console.log(
    "Authenticated user found:",
    !!authenticatedUser
  );

  // ==========================================
  // FIND ALL USERS
  // ==========================================

  const users = await User.find({})
    .select(
      "_id name email phone avatar online lastActive isAdmin isVerified coins referralCode referredBy createdAt updatedAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  console.log(
    "TOTAL USERS FOUND:",
    users.length
  );

  console.log(
    "USERS FOUND:",
    users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    }))
  );

  console.log("=================================\n");

  // ==========================================
  // RESPONSE
  // ==========================================

  return res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

/* ================= UPDATE USER ROLE (ADMIN ONLY) ================= */
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  // Validate role
  if (!["user", "admin"].includes(role)) {
    res.status(400);
    throw new Error("Invalid role. Use 'user' or 'admin'");
  }

  // Prevent admin from changing their own role
  if (req.user._id.toString() === userId) {
    res.status(400);
    throw new Error(
      "You cannot change your own administrator role"
    );
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Convert frontend role to your existing isAdmin field
  user.isAdmin = role === "admin";

  await user.save();

  res.status(200).json({
    success: true,
    message:
      role === "admin"
        ? "User promoted to admin successfully"
        : "Admin privileges removed successfully",
    data: {
      _id: user._id,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
      isAdmin: user.isAdmin,
      role: user.isAdmin ? "admin" : "user",
      active: user.active !== false,
      createdAt: user.createdAt,
    },
  });
});


module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyPhone,
  welcome,
  generateToken,
  getAllUsers,
  getUserById,
  updateUserRole,
};
