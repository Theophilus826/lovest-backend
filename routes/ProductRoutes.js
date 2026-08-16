const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/ProductController");

// Customer routes
router.get("/", getProducts);
router.get("/:id", getProduct);

// Admin routes
router.post("/", upload.single("image"), createProduct);
router.put("/:id", upload.single("image"), updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;