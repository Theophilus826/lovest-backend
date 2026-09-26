const express = require("express");

const {
  getPaymentSettings,
  updatePaymentSettings,
  initializePaystackPayment,
  verifyPaystackPayment,
  paystackWebhook,
} = require("../controllers/PaymentController");

const router = express.Router();

// ==========================================
// PAYMENT SETTINGS
// ==========================================

router.get(
  "/",
  getPaymentSettings
);

router.put(
  "/",
  updatePaymentSettings
);

// ==========================================
// PAYSTACK WEBHOOK
// ==========================================
//
// IMPORTANT:
// This route must receive the raw request body
// so Paystack's HMAC signature can be verified.
//

router.post(
  "/paystack/webhook",
  express.raw({
    type: "application/json",
  }),
  paystackWebhook
);

// ==========================================
// INITIALIZE PAYSTACK
// ==========================================

router.post(
  "/paystack/initialize",
  initializePaystackPayment
);

// ==========================================
// VERIFY PAYSTACK
// ==========================================

router.get(
  "/paystack/verify/:reference",
  verifyPaystackPayment
);

module.exports = router;
