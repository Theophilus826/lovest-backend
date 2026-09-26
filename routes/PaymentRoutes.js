const express = require("express");

const {
  getPaymentSettings,
  updatePaymentSettings,
  initializePaystackPayment,
  verifyPaystackPayment,
} = require("../controllers/PaymentController");

const router = express.Router();

router.get("/", getPaymentSettings);

router.put("/", updatePaymentSettings);

router.post(
  "/paystack/initialize",
  initializePaystackPayment
);

router.get(
  "/paystack/verify/:reference",
  verifyPaystackPayment
);

module.exports = router;
