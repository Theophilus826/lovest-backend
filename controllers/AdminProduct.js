
const Product = require("../model/Product");
const cloudinary = require("../config/Cloudinary");

// ==========================
// ADMIN - GET ALL PRODUCTS
// ==========================
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get all products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - GET SINGLE PRODUCT
// ==========================
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category");

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
    console.error("Get product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
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
    // DEBUG
    // ==========================

    console.log("========== CREATE PRODUCT ==========");
    console.log("Original Price Received:", originalPrice);
    console.log("Selling Price Received:", price);
    console.log("Request Body:", req.body);

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

    const parsedOriginalPrice = Number(originalPrice);
    const parsedPrice = Number(price);

    // ==========================
    // VALIDATE ORIGINAL PRICE
    // ==========================

    if (
      !Number.isFinite(parsedOriginalPrice) ||
      parsedOriginalPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Original price must be a valid number",
      });
    }

    // ==========================
    // VALIDATE SELLING PRICE
    // ==========================

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Selling price must be a valid number",
      });
    }

    // ==========================
    // PRICE RELATIONSHIP
    // ==========================

    if (parsedPrice > parsedOriginalPrice) {
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
    // IMAGES
    // ==========================

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    // ==========================
    // STOCK
    // ==========================

    const parsedStock =
      stock === undefined ||
      stock === null ||
      stock === ""
        ? 0
        : Number(stock);

    if (
      !Number.isFinite(parsedStock) ||
      parsedStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a valid number",
      });
    }

    // ==========================
    // DISCOUNT
    // ==========================

    let discountPercentage = 0;

    if (
      parsedOriginalPrice > 0 &&
      parsedPrice < parsedOriginalPrice
    ) {
      discountPercentage = Math.round(
        ((parsedOriginalPrice - parsedPrice) /
          parsedOriginalPrice) *
          100
      );
    }

    // ==========================
    // CLOUDINARY IMAGES
    // ==========================

    const images = req.files.map(
      (file) => file.path
    );

    const imagePublicIds = req.files.map(
      (file) => file.filename
    );

    const mainImage = images[0];

    // ==========================
    // CREATE PRODUCT
    // ==========================

    const product = await Product.create({
      name: name.trim(),

      description: description || "",

      // Original / crossed-out price
      originalPrice: parsedOriginalPrice,

      // Actual selling price
      price: parsedPrice,

      // Calculated discount
      discountPercentage,

      category,

      stock: parsedStock,

      featured:
        featured === "true" ||
        featured === true,

      active:
        active !== "false" &&
        active !== false,

      // Main image
      image: mainImage,

      // All images
      images,

      // Cloudinary public IDs
      imagePublicIds,
    });

    // ==========================
    // POPULATE CATEGORY
    // ==========================

    const populatedProduct =
      await Product.findById(product._id)
        .populate("category");

    // ==========================
    // VERIFY SAVED PRICE
    // ==========================

    console.log(
      "Saved Original Price:",
      populatedProduct?.originalPrice
    );

    console.log(
      "Saved Selling Price:",
      populatedProduct?.price
    );

    console.log(
      "Saved Discount:",
      populatedProduct?.discountPercentage
    );

    // ==========================
    // RESPONSE
    // ==========================

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populatedProduct,
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
// ADMIN - UPDATE PRODUCT
// ==========================
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

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
        Array.isArray(product.imagePublicIds) &&
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

      // New Cloudinary images
      const images = req.files.map(
        (file) => file.path
      );

      const imagePublicIds = req.files.map(
        (file) => file.filename
      );

      // First image = main image
      product.image = images[0];

      // All images
      product.images = images;

      // Cloudinary IDs
      product.imagePublicIds =
        imagePublicIds;
    }

    // ==========================
    // UPDATE NAME
    // ==========================

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();

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
            "Original price must be a valid number",
        });
      }

      product.originalPrice =
        newOriginalPrice;
    }

    // ==========================
    // UPDATE SELLING PRICE
    // ==========================

    if (
      req.body.price !== undefined
    ) {
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
            "Selling price must be a valid number",
        });
      }

      product.price = newPrice;
    }

    // ==========================
    // VALIDATE PRICES
    // ==========================

    if (
      product.price >
      product.originalPrice
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selling price cannot be greater than original price",
      });
    }

    // ==========================
    // UPDATE CATEGORY
    // ==========================

    if (
      req.body.category !== undefined
    ) {
      if (!req.body.category) {
        return res.status(400).json({
          success: false,
          message:
            "Product category cannot be empty",
        });
      }

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
            "Stock must be a valid number",
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
    //
    // discountPercentage will be
    // recalculated by ProductSchema
    // ==========================

    await product.save();

    // ==========================
    // POPULATE CATEGORY
    // ==========================

    const updatedProduct =
      await Product.findById(
        product._id
      ).populate("category");

    // ==========================
    // RESPONSE
    // ==========================

    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error(
      "Update product error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update product",
      error: error.message,
    });
  }
};


// ==========================
// ADMIN - DELETE PRODUCT
// ==========================
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // ==========================
    // DELETE CLOUDINARY IMAGE
    // ==========================

    if (product.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(
          product.imagePublicId
        );
      } catch (cloudinaryError) {
        console.error(
          "Failed to delete Cloudinary image:",
          cloudinaryError
        );
      }
    }

    // ==========================
    // DELETE PRODUCT
    // ==========================

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - TOGGLE PRODUCT STATUS
// ==========================
const toggleProductStatus = async (
  req,
  res
) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.active = !product.active;

    await product.save();

    res.status(200).json({
      success: true,
      message: product.active
        ? "Product activated successfully"
        : "Product deactivated successfully",
      data: product,
    });
  } catch (error) {
    console.error(
      "Toggle product status error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update product status",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - TOGGLE FEATURED
// ==========================
const toggleFeatured = async (req, res) => {
  try {
    const product = await Product.findById(
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.featured = !product.featured;

    await product.save();

    res.status(200).json({
      success: true,
      message: product.featured
        ? "Product added to featured"
        : "Product removed from featured",
      data: product,
    });
  } catch (error) {
    console.error(
      "Toggle featured error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update featured status",
      error: error.message,
    });
  }
};

module.exports = {
  getAllProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleFeatured,
};

