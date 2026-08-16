const Discount = require("../model/Discount");

// ==========================================
// GET ALL DISCOUNTS
// ==========================================

const getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: discounts.length,
      data: discounts,
    });
  } catch (error) {
    console.error(
      "Get discounts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch discounts",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE DISCOUNT
// ==========================================

const getDiscount = async (req, res) => {
  try {
    const discount =
      await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: discount,
    });
  } catch (error) {
    console.error(
      "Get discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch discount",
      error: error.message,
    });
  }
};

// ==========================================
// CREATE DISCOUNT
// ==========================================

const createDiscount = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      value,
      minimumPurchase,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      active,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Discount code is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Discount type is required",
      });
    }

    if (!["percentage", "fixed"].includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Discount type must be percentage or fixed",
      });
    }

    if (
      value === undefined ||
      value === null ||
      Number(value) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid discount value is required",
      });
    }

    if (
      type === "percentage" &&
      Number(value) > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Percentage discount cannot exceed 100%",
      });
    }

    const normalizedCode =
      code.trim().toUpperCase();

    const existingDiscount =
      await Discount.findOne({
        code: normalizedCode,
      });

    if (existingDiscount) {
      return res.status(409).json({
        success: false,
        message: "Discount code already exists",
      });
    }

    const discount =
      await Discount.create({
        code: normalizedCode,

        description:
          description || "",

        type,

        value: Number(value),

        minimumPurchase:
          minimumPurchase !== undefined
            ? Number(minimumPurchase)
            : 0,

        maxDiscount:
          maxDiscount !== undefined &&
          maxDiscount !== ""
            ? Number(maxDiscount)
            : null,

        startDate:
          startDate || null,

        endDate:
          endDate || null,

        usageLimit:
          usageLimit !== undefined &&
          usageLimit !== ""
            ? Number(usageLimit)
            : null,

        usageCount: 0,

        active:
          active !== false,
      });

    return res.status(201).json({
      success: true,
      message:
        "Discount created successfully",
      data: discount,
    });
  } catch (error) {
    console.error(
      "Create discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create discount",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE DISCOUNT
// ==========================================

const updateDiscount = async (req, res) => {
  try {
    const discount =
      await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount not found",
      });
    }

    const {
      code,
      description,
      type,
      value,
      minimumPurchase,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      active,
    } = req.body;

    // CODE
    if (code !== undefined) {
      const normalizedCode =
        code.trim().toUpperCase();

      const duplicate =
        await Discount.findOne({
          code: normalizedCode,
          _id: {
            $ne: discount._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "Discount code already exists",
        });
      }

      discount.code = normalizedCode;
    }

    // DESCRIPTION
    if (description !== undefined) {
      discount.description = description;
    }

    // TYPE
    if (type !== undefined) {
      if (
        !["percentage", "fixed"].includes(
          type
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid discount type",
        });
      }

      discount.type = type;
    }

    // VALUE
    if (value !== undefined) {
      const numericValue =
        Number(value);

      if (
        Number.isNaN(numericValue) ||
        numericValue < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid discount value",
        });
      }

      if (
        discount.type ===
          "percentage" &&
        numericValue > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Percentage discount cannot exceed 100%",
        });
      }

      discount.value = numericValue;
    }

    // MINIMUM PURCHASE
    if (
      minimumPurchase !== undefined
    ) {
      discount.minimumPurchase =
        Number(minimumPurchase) || 0;
    }

    // MAX DISCOUNT
    if (maxDiscount !== undefined) {
      discount.maxDiscount =
        maxDiscount === ""
          ? null
          : Number(maxDiscount);
    }

    // DATES
    if (startDate !== undefined) {
      discount.startDate =
        startDate || null;
    }

    if (endDate !== undefined) {
      discount.endDate =
        endDate || null;
    }

    // USAGE LIMIT
    if (usageLimit !== undefined) {
      discount.usageLimit =
        usageLimit === ""
          ? null
          : Number(usageLimit);
    }

    // ACTIVE
    if (active !== undefined) {
      discount.active =
        active === true ||
        active === "true";
    }

    await discount.save();

    return res.status(200).json({
      success: true,
      message:
        "Discount updated successfully",
      data: discount,
    });
  } catch (error) {
    console.error(
      "Update discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update discount",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE DISCOUNT
// ==========================================

const deleteDiscount = async (req, res) => {
  try {
    const discount =
      await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount not found",
      });
    }

    await discount.deleteOne();

    return res.status(200).json({
      success: true,
      message:
        "Discount deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete discount",
      error: error.message,
    });
  }
};

// ==========================================
// TOGGLE STATUS
// ==========================================

const toggleDiscountStatus = async (
  req,
  res
) => {
  try {
    const discount =
      await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount not found",
      });
    }

    const active =
      req.body.active !== undefined
        ? req.body.active === true ||
          req.body.active === "true"
        : !discount.active;

    discount.active = active;

    await discount.save();

    return res.status(200).json({
      success: true,
      message: active
        ? "Discount activated successfully"
        : "Discount deactivated successfully",
      data: discount,
    });
  } catch (error) {
    console.error(
      "Toggle discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update discount status",
      error: error.message,
    });
  }
};

// ==========================================
// VALIDATE DISCOUNT - CUSTOMER
// ==========================================

const validateDiscount = async (req, res) => {
  try {
    const {
      code,
      subtotal = 0,
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Discount code is required",
      });
    }

    const discount = await Discount.findOne({
      code: code.trim().toUpperCase(),
    });

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Invalid discount code",
      });
    }

    if (!discount.active) {
      return res.status(400).json({
        success: false,
        message: "This discount is inactive",
      });
    }

    const now = new Date();

    if (
      discount.startDate &&
      now < new Date(discount.startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "This discount is not active yet",
      });
    }

    if (
      discount.endDate &&
      now > new Date(discount.endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "This discount has expired",
      });
    }

    if (
      discount.usageLimit !== null &&
      discount.usageCount >=
        discount.usageLimit
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This discount usage limit has been reached",
      });
    }

    const orderSubtotal = Number(subtotal);

    if (
      Number.isNaN(orderSubtotal) ||
      orderSubtotal < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order subtotal",
      });
    }

    if (
      orderSubtotal <
      discount.minimumPurchase
    ) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₦${discount.minimumPurchase.toLocaleString()} required`,
      });
    }

    let discountAmount = 0;

    if (discount.type === "percentage") {
      discountAmount =
        (orderSubtotal * discount.value) /
        100;

      if (
        discount.maxDiscount !== null &&
        discount.maxDiscount !== undefined
      ) {
        discountAmount = Math.min(
          discountAmount,
          discount.maxDiscount
        );
      }
    } else {
      discountAmount = discount.value;
    }

    discountAmount = Math.min(
      discountAmount,
      orderSubtotal
    );

    const finalTotal =
      orderSubtotal - discountAmount;

    return res.status(200).json({
      success: true,
      message: "Discount applied successfully",

      data: {
        discount: {
          _id: discount._id,
          code: discount.code,
          type: discount.type,
          value: discount.value,
        },

        subtotal: orderSubtotal,

        discountAmount,

        total: finalTotal,
      },
    });
  } catch (error) {
    console.error(
      "Validate discount error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to validate discount",
      error: error.message,
    });
  }
};

module.exports = {
  getAllDiscounts,
  getDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  toggleDiscountStatus,
  validateDiscount,
};