const express = require("express");

const {

  getPaymentSettings,

  updatePaymentSettings,

  initializePaystackPayment,

  verifyPaystackPayment,

  paystackWebhook,

} = require(
  "../controllers/PaymentController"
);


const router =
  express.Router();


// ==========================================
// PAYMENT SETTINGS
// ==========================================

// GET /api/payments

router.get(
  "/",
  getPaymentSettings
);


// ==========================================
// UPDATE PAYMENT SETTINGS
// ==========================================

// PUT /api/payments

router.put(
  "/",
  updatePaymentSettings
);


// ==========================================
// INITIALIZE PAYSTACK
// ==========================================

// POST /api/payments/paystack/initialize

router.post(
  "/paystack/initialize",
  initializePaystackPayment
);


// ==========================================
// VERIFY PAYSTACK
// ==========================================

// GET /api/payments/paystack/verify/:reference

router.get(
  "/paystack/verify/:reference",
  verifyPaystackPayment
);


// ==========================================
// PAYSTACK WEBHOOK
// ==========================================

// POST /api/payments/paystack/webhook

router.post(
  "/paystack/webhook",
  paystackWebhook
);


module.exports = router;
