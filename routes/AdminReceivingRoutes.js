const express = require("express");

const {
  getReceivingPurchases,
  getReceivingPurchase,
  receivePayment,
} = require("../controllers/AdminReceivingController");

const {
  protect,
  admin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  admin,
  getReceivingPurchases
);

router.get(
  "/:id",
  protect,
  admin,
  getReceivingPurchase
);

router.post(
  "/:id/receive",
  protect,
  admin,
  receivePayment
);

module.exports = router;