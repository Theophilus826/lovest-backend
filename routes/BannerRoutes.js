const express = require("express");

const {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} = require("../controllers/BannerController");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// GET /api/admin/banners
router.get("/", getAllBanners);

// POST /api/admin/banners
router.post(
  "/",
  upload.single("image"),
  createBanner
);

// PUT /api/admin/banners/:id
router.put(
  "/:id",
  upload.single("image"),
  updateBanner
);

// DELETE /api/admin/banners/:id
router.delete(
  "/:id",
  deleteBanner
);

// PATCH /api/admin/banners/:id/toggle
router.patch(
  "/:id/toggle",
  toggleBannerStatus
);

module.exports = router;