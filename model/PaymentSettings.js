const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    // ==========================================
    // MANUAL BANK TRANSFER
    // ==========================================

    bankTransferEnabled: {
      type: Boolean,
      default: true,
    },

    bankName: {
      type: String,
      trim: true,
      default: "",
    },

    accountName: {
      type: String,
      trim: true,
      default: "",
    },

    accountNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // PAYSTACK
    // ==========================================

    paystackEnabled: {
      type: Boolean,
      default: true,
    },

    paystackPublicKey: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // OPTIONAL CUSTOM PAYMENT LINK
    // ==========================================

    paymentLinkEnabled: {
      type: Boolean,
      default: false,
    },

    paymentLink: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Payment",
  PaymentSchema
);
