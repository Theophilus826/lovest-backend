
const express = require("express");

const router = express.Router();

// ==========================================
// CONTROLLERS
// ==========================================

const {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleFeatured,
} = require("../controllers/AdminProduct");

const {
  getAllUsers,
  updateUserRole,
} = require("../controllers/UserController");

// ==========================================
// MIDDLEWARE
// ==========================================

const upload = require("../middleware/uploadMiddleware");
const {
  protect,
  admin,
} = require("../middleware/AuthMiddleware");

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

router.use(protect);
router.use(admin);

// ==========================================
// ADMIN USERS
// IMPORTANT: KEEP THESE BEFORE /:id
// ==========================================

// GET /api/admin/users
router.get("/users", getAllUsers);

// PATCH /api/admin/users/:userId/role
router.patch(
  "/users/:userId/role",
  updateUserRole
);

// ==========================================
// ADMIN PRODUCTS
// ==========================================

// GET /api/admin/products
router.get("/", getAllProducts);

// GET /api/admin/products/:id
router.get("/:id", getProduct);

// POST /api/admin/products
router.post(
  "/",
  upload.array("images", 5),
  createProduct
);

// PUT /api/admin/products/:id
router.put(
  "/:id",
  upload.array("images", 5),
  updateProduct
);

// DELETE /api/admin/products/:id
router.delete(
  "/:id",
  deleteProduct
);

// ==========================================
// PRODUCT CONTROLS
// ==========================================

// PATCH /api/admin/products/:id/status
router.patch(
  "/:id/status",
  toggleProductStatus
);

// PATCH /api/admin/products/:id/featured
router.patch(
  "/:id/featured",
  toggleFeatured
);

module.exports = router;

