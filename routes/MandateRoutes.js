const express = require("express");

const router = express.Router();

const MandateController = require("../controllers/MandateController");

/**
 * Paystack browser callback
 *
 * IMPORTANT:
 * No requireAuth here.
 *
 * Paystack redirects the customer's browser directly
 * to this endpoint.
 */
router.get(
  "/callback",
  MandateController.callback
);

module.exports = router;
