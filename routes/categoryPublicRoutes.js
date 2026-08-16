const express = require("express");

const {
  getActiveCategories,
  getCategory,
} = require("../controllers/CategoryController");

const router = express.Router();


router.get("/", getActiveCategories);
// GET /api/categories/:id
router.get("/:id", getCategory);

module.exports = router;