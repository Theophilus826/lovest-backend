const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    // ==========================================
    // PRODUCT INFORMATION
    // ==========================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ==========================================
    // PRICING
    // ==========================================

    // Original price shown crossed out
    // Example: $100
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Actual price customer pays
    // Example: $75
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================
    // INVENTORY
    // ==========================================

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // IMAGES
    // ==========================================

    // Main image for backwards compatibility
    image: {
      type: String,
      default: "",
    },

    // Multiple product images
    images: {
      type: [String],
      default: [],
    },

    // Cloudinary/public image IDs
    imagePublicIds: {
      type: [String],
      default: [],
    },

    // ==========================================
    // CATEGORY
    // ==========================================

    category: {
      type: String,
      default: "",
    },

    // ==========================================
    // PRODUCT STATUS
    // ==========================================

    featured: {
      type: Boolean,
      default: false,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Product",
  ProductSchema
);