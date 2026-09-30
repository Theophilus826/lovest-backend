
const express = require("express");

const {
  getPaymentSettings,
  updatePaymentSettings,

  initializePaystackPayment,
  verifyPaystackPayment,

  paystackWebhook,

  forwardLoanTransferWebhook,
  forwardKycVerificationWebhook,
} = require("../controllers/PaymentController");

const router = express.Router();


// ==========================================
// PAYMENT SETTINGS
// ==========================================

router.get(
  "/",
  getPaymentSettings,
);

router.put(
  "/",
  updatePaymentSettings,
);


// ==========================================
// PAYSTACK WEBHOOK
// ==========================================
//
// IMPORTANT:
//
// This route MUST receive the raw request body.
//
// Paystack's webhook signature is generated from
// the exact raw request body.
//
// DO NOT put express.json() before this route
// for this endpoint.
//

router.post(
  "/paystack/webhook",

  express.raw({
    type: "application/json",
  }),

  paystackWebhook,
);


// ==========================================
// INITIALIZE PAYSTACK PAYMENT
// ==========================================

router.post(
  "/paystack/initialize",
  initializePaystackPayment,
);


// ==========================================
// VERIFY PAYSTACK PAYMENT
// ==========================================

router.get(
  "/paystack/verify/:reference",
  verifyPaystackPayment,
);


// ==========================================
// INTERNAL LOAN TRANSFER FORWARDING
// ==========================================
//
// Normally this is NOT called directly by the
// frontend.
//
// The Paystack webhook calls
// forwardLoanTransferWebhook() internally.
//

router.post(
  "/internal/loan-transfer-webhook",
  express.json(),
  async (req, res) => {
    try {
      const event = req.body;

      if (
        !event ||
        typeof event !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook event is required",
        });
      }

      const forwarded =
        await forwardLoanTransferWebhook(
          event,
        );

      if (!forwarded) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to forward loan transfer webhook",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Loan transfer webhook forwarded successfully",
      });

    } catch (error) {
      console.error(
        "INTERNAL LOAN TRANSFER WEBHOOK ERROR:",
        error.message,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to forward loan transfer webhook",
      });
    }
  },
);


// ==========================================
// INTERNAL KYC WEBHOOK FORWARDING
// ==========================================
//
// Normally this is also NOT called directly
// by the frontend.
//
// The Paystack webhook calls
// forwardKycVerificationWebhook() internally.
//

router.post(
  "/internal/kyc-webhook",
  express.json(),
  async (req, res) => {
    try {
      const event = req.body;

      if (
        !event ||
        typeof event !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Webhook event is required",
        });
      }

      const forwarded =
        await forwardKycVerificationWebhook(
          event,
        );

      if (!forwarded) {
        return res.status(500).json({
          success: false,
          message:
            "Failed to forward KYC webhook",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "KYC webhook forwarded successfully",
      });

    } catch (error) {
      console.error(
        "INTERNAL KYC WEBHOOK ERROR:",
        error.message,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to forward KYC webhook",
      });
    }
  },
);


// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;

