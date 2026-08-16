const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
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