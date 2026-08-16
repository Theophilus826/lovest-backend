const Category = require("../model/Category");
const cloudinary = require("../config/Cloudinary");

// ==========================
// ADMIN - GET ALL CATEGORIES
// ==========================
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error(
      "Get categories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - GET SINGLE CATEGORY
// ==========================
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(
      req.params.id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error(
      "Get category error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - CREATE CATEGORY
// ==========================
const createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      active,
    } = req.body;

    // ==========================
    // VALIDATION
    // ==========================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // ==========================
    // CHECK DUPLICATE
    // ==========================

    const existingCategory =
      await Category.findOne({
        name: name.trim(),
      });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    // ==========================
    // CREATE
    // ==========================

    const category = await Category.create({
      name: name.trim(),

      description:
        description || "",

      active:
        active !== "false" &&
        active !== false,

      image: req.file
        ? req.file.path
        : "",

      imagePublicId: req.file
        ? req.file.filename
        : "",
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error(
      "Create category error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - UPDATE CATEGORY
// ==========================
const updateCategory = async (req, res) => {
  try {
    const category =
      await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ==========================
    // CHECK NAME
    // ==========================

    if (req.body.name !== undefined) {
      const name = req.body.name.trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "Category name cannot be empty",
        });
      }

      const duplicate =
        await Category.findOne({
          name,
          _id: {
            $ne: category._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Category already exists",
        });
      }

      category.name = name;
    }

    // ==========================
    // DESCRIPTION
    // ==========================

    if (
      req.body.description !== undefined
    ) {
      category.description =
        req.body.description;
    }

    // ==========================
    // ACTIVE
    // ==========================

    if (req.body.active !== undefined) {
      category.active =
        req.body.active === "true" ||
        req.body.active === true;
    }

    // ==========================
    // UPDATE IMAGE
    // ==========================

    if (req.file) {
      if (category.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(
            category.imagePublicId
          );
        } catch (cloudinaryError) {
          console.error(
            "Failed to delete old category image:",
            cloudinaryError
          );
        }
      }

      category.image = req.file.path;
      category.imagePublicId =
        req.file.filename;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error(
      "Update category error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - DELETE CATEGORY
// ==========================
const deleteCategory = async (req, res) => {
  try {
    const category =
      await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ==========================
    // CHECK PRODUCTS
    // ==========================

    const Product = require("../model/Product");

    const productsCount =
      await Product.countDocuments({
        category: category._id,
      });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete this category because products are using it.",
      });
    }

    // ==========================
    // DELETE IMAGE
    // ==========================

    if (category.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(
          category.imagePublicId
        );
      } catch (cloudinaryError) {
        console.error(
          "Failed to delete category image:",
          cloudinaryError
        );
      }
    }

    // ==========================
    // DELETE CATEGORY
    // ==========================

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete category error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

// ==========================
// ADMIN - TOGGLE CATEGORY
// ==========================
const toggleCategoryStatus = async (
  req,
  res
) => {
  try {
    const category =
      await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.active = !category.active;

    await category.save();

    res.status(200).json({
      success: true,
      message: category.active
        ? "Category activated successfully"
        : "Category deactivated successfully",
      data: category,
    });
  } catch (error) {
    console.error(
      "Toggle category error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update category status",
      error: error.message,
    });
  }
};
// ==========================
// PUBLIC - GET CATEGORY
// ==========================
const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      active: true,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error(
      "GET ACTIVE CATEGORIES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};


module.exports = {
  getAllCategories,
  getCategory,
  createCategory,
 getActiveCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
};

