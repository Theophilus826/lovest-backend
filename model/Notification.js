
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // ==========================================
    // USER RECEIVING NOTIFICATION
    // ==========================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================
    // USER WHO SENT NOTIFICATION
    // ==========================================

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ==========================================
    // NOTIFICATION TYPE
    // ==========================================

    type: {
      type: String,
      enum: [
        "system",
        "order",
        "message",
        "post",
        "like",
        "comment",
        "follow",
      ],
      default: "system",
    },

    // ==========================================
    // MESSAGE
    // ==========================================

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ==========================================
    // RELATED POST
    // ==========================================

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // ==========================================
    // RELATED ORDER
    // ==========================================

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // ==========================================
    // READ STATUS
    // ==========================================

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================
    // CREATED
    // ==========================================

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
);

module.exports = mongoose.model(
  "Notification",
  notificationSchema,
);

