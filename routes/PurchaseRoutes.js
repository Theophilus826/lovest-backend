const express = require("express");

const {
  createPurchase,
  getMyPurchase,
  getPurchase,
  cancelPurchase,
  recordReceivingPayment,
  getAllPurchases,
} = require("../controllers/PurchaseController");

const { protect, admin } = require("../middleware/AuthMiddleware");

const router = express.Router();

// Create purchase
router.post(
  "/",
  protect,
  createPurchase
);

// Admin: get all purchases
router.get(
  "/",
  protect,
  admin,
  getAllPurchases
);

// Get user's purchases
router.get(
  "/my",
  protect,
  getMyPurchase
);

// Get single purchase
router.get(
  "/:id",
  protect,
  getPurchase
);

// Cancel purchase
router.patch(
  "/:id/cancel",
  protect,
  cancelPurchase
);

router.post(
  "/:id/receiving",
  protect,
  recordReceivingPayment
);

module.exports = router;
