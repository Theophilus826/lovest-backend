const express = require("express");

const {
  getAllDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleDiscountStatus,
} = require("../controllers/DiscountController");

const router = express.Router();

// GET /api/admin/discounts
router.get("/", getAllDiscounts);

// GET /api/admin/discounts/:id
router.get("/:id", getDiscount);

// POST /api/admin/discounts
router.post("/", createDiscount);

// PUT /api/admin/discounts/:id
router.put("/:id", updateDiscount);

// DELETE /api/admin/discounts/:id
router.delete("/:id", deleteDiscount);

// PATCH /api/admin/discounts/:id/status
router.patch(
  "/:id/status",
  toggleDiscountStatus
);

module.exports = router;