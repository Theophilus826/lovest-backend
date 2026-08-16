const Product = require("../model/Product");
const cloudinary = require("../config/Cloudinary");

// ==========================
// GET ALL ACTIVE PRODUCTS
// ==========================

const getProducts = async (req, res) => {
  try {
    const { category } = req.query;

    const filter = {
      active: true,
    };

    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .populate("category", "name image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};


// ==========================
// GET SINGLE PRODUCT
// ==========================
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// CREATE PRODUCT
// ==========================
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      originalPrice,
      price,
      category,
      featured,
      active,
      stock,
    } = req.body;

    // ==========================
    // VALIDATION
    // ==========================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    // ==========================
    // ORIGINAL PRICE
    // ==========================

    if (
      originalPrice === undefined ||
      originalPrice === null ||
      originalPrice === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Original price is required",
      });
    }

    // ==========================
    // SELLING PRICE
    // ==========================

    if (
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Selling price is required",
      });
    }

    // ==========================
    // CONVERT PRICES
    // ==========================

    const originalPriceNumber = Number(originalPrice);
    const priceNumber = Number(price);

    // ==========================
    // VALIDATE PRICES
    // ==========================

    if (
      !Number.isFinite(originalPriceNumber) ||
      !Number.isFinite(priceNumber)
    ) {
      return res.status(400).json({
        success: false,
        message: "Prices must be valid numbers",
      });
    }

    if (
      originalPriceNumber < 0 ||
      priceNumber < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Prices cannot be negative",
      });
    }

    // Selling price cannot be higher
    // than original price
    if (priceNumber > originalPriceNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Selling price cannot be greater than original price",
      });
    }

    // ==========================
    // CATEGORY
    // ==========================

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Product category is required",
      });
    }

    // ==========================
    // STOCK
    // ==========================

    const stockNumber =
      stock === undefined ||
      stock === null ||
      stock === ""
        ? 0
        : Number(stock);

    if (
      !Number.isFinite(stockNumber) ||
      stockNumber < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a valid number",
      });
    }

    // ==========================
    // DISCOUNT
    // ==========================

    const discountPercentage =
      originalPriceNumber > 0 &&
      priceNumber < originalPriceNumber
        ? Math.round(
            ((originalPriceNumber - priceNumber) /
              originalPriceNumber) *
              100
          )
        : 0;

    // ==========================
    // CLOUDINARY IMAGES
    // ==========================

    const images = req.files
      ? req.files.map((file) => file.path)
      : [];

    const imagePublicIds = req.files
      ? req.files.map((file) => file.filename)
      : [];

    // First image becomes main image
    const mainImage =
      images.length > 0 ? images[0] : "";

    // ==========================
    // CREATE PRODUCT
    // ==========================

    const product = await Product.create({
      name: name.trim(),

      description: description || "",

      // Original / crossed-out price
      originalPrice: originalPriceNumber,

      // Actual selling price
      price: priceNumber,

      // Discount percentage
      discountPercentage,

      category,

      stock: stockNumber,

      featured:
        featured === "true" ||
        featured === true,

      active:
        active !== "false" &&
        active !== false,

      // Main image
      image: mainImage,

      // Multiple images
      images,

      // Cloudinary public IDs
      imagePublicIds,
    });

    // ==========================
    // RESPONSE
    // ==========================

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "Create product error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// ==========================
// UPDATE PRODUCT
// ==========================
const updateProduct = async (req, res) => {
  try {
    const product =
      await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==========================
    // UPDATE IMAGES
    // ==========================

    if (
      req.files &&
      req.files.length > 0
    ) {
      // Delete old Cloudinary images
      if (
        product.imagePublicIds &&
        product.imagePublicIds.length > 0
      ) {
        for (const publicId of product.imagePublicIds) {
          try {
            await cloudinary.uploader.destroy(
              publicId
            );
          } catch (cloudinaryError) {
            console.error(
              "Failed to delete old Cloudinary image:",
              cloudinaryError
            );
          }
        }
      }

      // New images
      const images = req.files.map(
        (file) => file.path
      );

      const imagePublicIds =
        req.files.map(
          (file) => file.filename
        );

      // First image becomes main image
      product.image = images[0];

      product.images = images;

      product.imagePublicIds =
        imagePublicIds;
    }

    // ==========================
    // UPDATE NAME
    // ==========================

    if (req.body.name !== undefined) {
      const name = req.body.name.trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "Product name cannot be empty",
        });
      }

      product.name = name;
    }

    // ==========================
    // UPDATE DESCRIPTION
    // ==========================

    if (
      req.body.description !== undefined
    ) {
      product.description =
        req.body.description;
    }

    // ==========================
    // UPDATE ORIGINAL PRICE
    // ==========================

    if (
      req.body.originalPrice !== undefined
    ) {
      if (
        req.body.originalPrice === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Original price cannot be empty",
        });
      }

      const newOriginalPrice = Number(
        req.body.originalPrice
      );

      if (
        Number.isNaN(newOriginalPrice) ||
        newOriginalPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Original price must be a valid positive number",
        });
      }

      product.originalPrice =
        newOriginalPrice;
    }

    // ==========================
    // UPDATE SELLING PRICE
    // ==========================

    if (req.body.price !== undefined) {
      if (req.body.price === "") {
        return res.status(400).json({
          success: false,
          message:
            "Selling price cannot be empty",
        });
      }

      const newPrice = Number(
        req.body.price
      );

      if (
        Number.isNaN(newPrice) ||
        newPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selling price must be a valid positive number",
        });
      }

      product.price = newPrice;
    }

    // ==========================
    // UPDATE CATEGORY
    // ==========================

    if (
      req.body.category !== undefined
    ) {
      product.category =
        req.body.category;
    }

    // ==========================
    // UPDATE STOCK
    // ==========================

    if (
      req.body.stock !== undefined
    ) {
      const newStock =
        req.body.stock === ""
          ? 0
          : Number(req.body.stock);

      if (
        Number.isNaN(newStock) ||
        newStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Stock must be a valid positive number",
        });
      }

      product.stock = newStock;
    }

    // ==========================
    // UPDATE FEATURED
    // ==========================

    if (
      req.body.featured !== undefined
    ) {
      product.featured =
        req.body.featured === "true" ||
        req.body.featured === true;
    }

    // ==========================
    // UPDATE ACTIVE
    // ==========================

    if (
      req.body.active !== undefined
    ) {
      product.active =
        req.body.active === "true" ||
        req.body.active === true;
    }

    // ==========================
    // SAVE
    // ==========================

    await product.save();

    // ==========================
    // RESPONSE
    // ==========================

    res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "Update product error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update product",
      error: error.message,
    });
  }
};


// ==========================
// DELETE PRODUCT
// ==========================
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete image from Cloudinary
    if (product.imagePublicId) {
      await cloudinary.uploader.destroy(product.imagePublicId);
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};