const express = require("express");

const {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} = require("../controllers/CategoryController");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// GET /api/admin/categories
router.get("/", getAllCategories);

// GET /api/admin/categories/:id
router.get("/:id", getCategory);

// POST /api/admin/categories
router.post(
  "/",
  upload.single("image"),
  createCategory
);

// PUT /api/admin/categories/:id
router.put(
  "/:id",
  upload.single("image"),
  updateCategory
);

// DELETE /api/admin/categories/:id
router.delete(
  "/:id",
  deleteCategory
);

// PATCH /api/admin/categories/:id/toggle
router.patch(
  "/:id/toggle",
  toggleCategoryStatus
);

module.exports = router;