
const express = require("express");
const router = express.Router();

const multer = require("multer");
const {
  CloudinaryStorage,
} = require("multer-storage-cloudinary");

const cloudinary = require("../config/Cloudinary");

/* =========================================================
   CONTROLLER
========================================================= */

const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyPhone,
  welcome,
  getAllUsers,
  getUserById,
  updateUserRole,
} = require("../controllers/UserController");

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

const {
  protect,
  admin,
} = require("../middleware/AuthMiddleware");

/* =========================================================
   MULTER / CLOUDINARY
========================================================= */

const storage = new CloudinaryStorage({
  cloudinary,

  params: {
    folder: "avatars",
    resource_type: "image",

    allowed_formats: [
      "jpg",
      "png",
      "jpeg",
      "webp",
    ],
  },
});

const upload = multer({
  storage,
});

/* =========================================================
   PUBLIC AUTH
========================================================= */

router.post(
  "/register",
  registerUser
);

router.post(
  "/login",
  loginUser
);

router.post(
  "/logout",
  logoutUser
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.put(
  "/reset-password/:token",
  resetPassword
);

router.post(
  "/verify-phone",
  verifyPhone
);

/* =========================================================
   PROTECTED
========================================================= */

router.get(
  "/welcome",
  protect,
  welcome
);

/* =========================================================
   ADMIN - USERS
========================================================= */

/*
  GET ALL USERS

  GET /api/users
*/

router.get(
  "/",
  protect,
  admin,
  getAllUsers
);

/*
  CHANGE USER ROLE

  PATCH /api/users/:userId/role

  IMPORTANT:
  This must be PATCH because your frontend uses:

  API.patch(
    `/admin/users/${user._id}/role`,
    { role }
  )
*/

router.patch(
  "/:userId/role",
  protect,
  admin,
  updateUserRole
);

/* =========================================================
   SINGLE USER
   KEEP THIS AFTER SPECIFIC ROUTES
========================================================= */

router.get(
  "/:userId",
  protect,
  getUserById
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;

