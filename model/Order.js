const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    // ==========================================
    // CUSTOMER USER
    // ==========================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==========================================
    // CUSTOMER SNAPSHOT
    // ==========================================

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
    },

    // ==========================================
    // DELIVERY ADDRESS
    // ==========================================

    deliveryAddress: {
      address: {
        type: String,
        required: true,
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      country: {
        type: String,
        trim: true,
        default: "",
      },

      postalCode: {
        type: String,
        trim: true,
        default: "",
      },
    },

    // ==========================================
    // ORDER ITEMS
    // ==========================================

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        name: {
          type: String,
          required: true,
          trim: true,
        },

        image: {
          type: String,
          default: "",
        },

        originalPrice: {
          type: Number,
          default: 0,
          min: 0,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        total: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    // ==========================================
    // PRICING
    // ==========================================

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================
    // ORDER STATUS
    //
    // This represents the overall order lifecycle.
    // ==========================================

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    // ==========================================
    // PAYMENT
    // ==========================================

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "bank_transfer", "online"],
      default: "cash_on_delivery",
    },

    // ==========================================
    // SHIPPING
    //
    // Shipping status is independent from the
    // main order status so admin can manually
    // change shipment progress.
    // ==========================================

    shippingStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },

    shipping: {
      // Carrier / courier name
      courier: {
        type: String,
        trim: true,
        default: "",
      },

      // Tracking number
      trackingNumber: {
        type: String,
        trim: true,
        default: "",
      },

      // When shipment was marked as shipped
      shippedAt: {
        type: Date,
        default: null,
      },

      // Expected delivery date
      estimatedDeliveryDate: {
        type: Date,
        default: null,
      },

      // When shipment was marked as delivered
      deliveredAt: {
        type: Date,
        default: null,
      },

      // Optional admin shipping notes
      notes: {
        type: String,
        trim: true,
        default: "",
      },
      customerConfirmed: {
        type: Boolean,
        default: false,
      },

      customerConfirmedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

// ==========================================
// AUTOMATIC SHIPPING TIMESTAMPS
// ==========================================
//
// This keeps shippedAt / deliveredAt synchronized
// when an admin manually changes shippingStatus.
//

OrderSchema.pre("save", function (next) {
  if (this.isModified("shippingStatus")) {
    if (this.shippingStatus === "shipped") {
      if (!this.shipping?.shippedAt) {
        this.shipping.shippedAt = new Date();
      }
    }

    if (this.shippingStatus === "delivered") {
      if (!this.shipping?.shippedAt) {
        this.shipping.shippedAt = new Date();
      }

      if (!this.shipping?.deliveredAt) {
        this.shipping.deliveredAt = new Date();
      }
    }

    if (this.shippingStatus !== "delivered") {
      this.shipping.deliveredAt = null;
    }
  }

  next();
});

module.exports = mongoose.model("Order", OrderSchema);
