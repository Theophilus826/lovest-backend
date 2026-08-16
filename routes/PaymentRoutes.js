const express = require("express");

const {
  getPaymentSettings,
  updatePaymentSettings,
  getAdminPayments,
} = require("../controllers/PaymentController");

const router = express.Router();

// ==========================================
// GET PAYMENT SETTINGS
// GET /api/payments
// ==========================================

router.get("/", getPaymentSettings);

// ==========================================
// UPDATE PAYMENT SETTINGS
// PUT /api/payments
// ==========================================

router.put("/", updatePaymentSettings);


module.exports = router;