const Product = require("../model/Product");
const PurchaseOrder = require("../model/PurchaseOrder");

const CONTRIBUTION_PHASES = [4, 6, 7];

const PURCHASE_TYPES = [
  "FULL_PAYMENT",
  "CONTRIBUTION",
  "LOAN",
  "RESELLER",
];

// ==========================================
// CREATE PURCHASE
// ==========================================

const createPurchase = async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      purchaseType,
      contributionPhases,
      deposit = 0,
    } = req.body;

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // ==========================================
    // PURCHASE TYPE
    // ==========================================

    if (!PURCHASE_TYPES.includes(purchaseType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase type",
      });
    }

    // ==========================================
    // PRODUCT
    // ==========================================

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.active === false) {
      return res.status(400).json({
        success: false,
        message: "This product is currently unavailable",
      });
    }

    // ==========================================
    // QUANTITY
    // ==========================================

    const purchaseQuantity = Number(quantity);

    if (
      !Number.isInteger(purchaseQuantity) ||
      purchaseQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    // ==========================================
    // STOCK
    // ==========================================

    const stock = Number(product.stock || 0);

    if (stock < purchaseQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} item(s) available`,
      });
    }

    // ==========================================
    // PRICE
    // ==========================================

    const unitPrice = Number(product.price || 0);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product has an invalid price",
      });
    }

    const totalAmount = Number(
      (unitPrice * purchaseQuantity).toFixed(2)
    );

    // ==========================================
    // BASE PURCHASE
    // ==========================================

    const purchaseData = {
      user: req.user._id,
      product: product._id,
      quantity: purchaseQuantity,
      unitPrice,
      totalAmount,
      purchaseType,
      status: "PENDING_PAYMENT",
    };

    // ==========================================
    // FULL PAYMENT
    // ==========================================

    if (purchaseType === "FULL_PAYMENT") {
      purchaseData.payment = {
        requiredAmount: totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: "PENDING",
      };
    }

    // ==========================================
    // CONTRIBUTION
    // ==========================================

    if (purchaseType === "CONTRIBUTION") {
      const phases = Number(contributionPhases);

      if (!CONTRIBUTION_PHASES.includes(phases)) {
        return res.status(400).json({
          success: false,
          message:
            "Contribution plan must be 4, 6, or 7 phases",
        });
      }

      const amountPerPhase = Number(
        (totalAmount / phases).toFixed(2)
      );

      purchaseData.contribution = {
        phases,
        currentPhase: 0,
        amountPerPhase,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: "ACTIVE",
        nextPaymentDue: null,
      };

      purchaseData.status = "CONTRIBUTION_ACTIVE";
    }

    // ==========================================
    // LOAN
    // ==========================================

    if (purchaseType === "LOAN") {
      const loanDeposit = Number(deposit);

      if (
        !Number.isFinite(loanDeposit) ||
        loanDeposit < 0 ||
        loanDeposit >= totalAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Loan deposit must be less than the product total",
        });
      }

      const loanAmount = Number(
        (totalAmount - loanDeposit).toFixed(2)
      );

      purchaseData.loan = {
        productAmount: totalAmount,
        deposit: loanDeposit,
        loanAmount,
        approvedAmount: 0,
        repaymentAmount: 0,
        repaymentMonths: 0,
        totalRepayment: 0,
        paidAmount: loanDeposit,
        remainingAmount: loanAmount,
        status: "PENDING_APPROVAL",
      };

      purchaseData.status =
        "PENDING_LOAN_APPROVAL";
    }

    // ==========================================
    // RESELLER
    // ==========================================

    if (purchaseType === "RESELLER") {
      purchaseData.reseller = {
        quantity: purchaseQuantity,
        unitPrice,
        totalAmount,
        status: "PENDING",
      };

      purchaseData.status = "PENDING_PAYMENT";
    }

    // ==========================================
    // CREATE PURCHASE ORDER
    // ==========================================

    const purchase = await PurchaseOrder.create(
      purchaseData
    );

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (error) {
    console.error("CREATE PURCHASE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create purchase",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================
// GET MY PURCHASES
// ==========================================

const getMyPurchase = async (req, res) => {
  try {
    const purchases = await PurchaseOrder.find({
      user: req.user._id,
    })
      .populate("product", "name price image images")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error(
      "GET MY PURCHASES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get purchases",
    });
  }
};

// ==========================================
// GET SINGLE PURCHASE
// ==========================================

const getPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    // Admins can fetch any purchase; regular users can only fetch their own
    let purchase;

    if (req.user && req.user.isAdmin === true) {
      purchase = await PurchaseOrder.findById(id)
        .populate(
          "product",
          "name price image images description"
        )
        .populate("user", "name email phone");
    } else {
      purchase = await PurchaseOrder.findOne({
        _id: id,
        user: req.user._id,
      }).populate(
        "product",
        "name price image images description"
      );
    }

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error(
      "GET PURCHASE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get purchase",
    });
  }
};

// ==========================================
// CANCEL PURCHASE
// ==========================================

const cancelPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await PurchaseOrder.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // ==========================================
    // CHECK IF ALREADY CANCELLED
    // ==========================================

    if (purchase.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Purchase is already cancelled",
      });
    }

    // ==========================================
    // PREVENT CANCELLING COMPLETED PURCHASES
    // ==========================================

    if (
      [
        "DELIVERED",
        "COMPLETED",
      ].includes(purchase.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This purchase can no longer be cancelled",
      });
    }

    // ==========================================
    // CANCEL
    // ==========================================

    purchase.status = "CANCELLED";
    purchase.cancelledAt = new Date();

    purchase.cancellationReason =
      req.body.reason ||
      "Cancelled by customer";

    // ==========================================
    // CANCEL CONTRIBUTION
    // ==========================================

    if (purchase.contribution) {
      purchase.contribution.status =
        "CANCELLED";
    }

    // ==========================================
    // CANCEL LOAN
    // ==========================================

    if (purchase.loan) {
      purchase.loan.status = "REJECTED";
    }

    // ==========================================
    // CANCEL RESELLER
    // ==========================================

    if (purchase.reseller) {
      purchase.reseller.status =
        "CANCELLED";
    }

    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully",
      data: purchase,
    });
  } catch (error) {
    console.error(
      "CANCEL PURCHASE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to cancel purchase",
    });
  }
};

// ==========================================
// GET ALL PURCHASES
// Admin
// ==========================================

const getAllPurchases = async (req, res) => {
  try {
    const purchases = await PurchaseOrder.find()
      .populate("user", "name email phone")
      .populate("product", "name price image")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error(
      "GET ALL PURCHASES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
    });
  }
};

const recordReceivingPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      amount,
      method,
      reference = "",
    } = req.body;

    // ==========================================
    // VALIDATE AMOUNT
    // ==========================================

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid payment amount",
      });
    }

    // ==========================================
    // VALIDATE METHOD
    // ==========================================

    const validMethods = [
      "BANK_TRANSFER",
      "CASH",
      "CARD",
      "POS",
      "OTHER",
    ];

    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // ==========================================
    // FIND PURCHASE
    // ==========================================

    const purchaseOrder =
      await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    // ==========================================
    // INITIALIZE RECEIVING
    // ==========================================

    if (!purchaseOrder.receiving) {
      purchaseOrder.receiving = {
        totalReceived: 0,
        remainingAmount:
          purchaseOrder.totalAmount,
        payments: [],
        status: "PENDING",
      };
    }

    // ==========================================
    // CURRENT VALUES
    // ==========================================

    const totalAmount =
      Number(purchaseOrder.totalAmount);

    const totalReceived =
      Number(
        purchaseOrder.receiving.totalReceived ||
          0
      );

    const remainingAmount =
      Number(
        purchaseOrder.receiving.remainingAmount ??
          totalAmount - totalReceived
      );

    // ==========================================
    // PREVENT OVERPAYMENT
    // ==========================================

    if (paymentAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed remaining amount of ₦${remainingAmount.toLocaleString()}`,
      });
    }

    // ==========================================
    // ADD PAYMENT
    // ==========================================

    purchaseOrder.receiving.payments.push({
      amount: paymentAmount,
      method,
      reference: reference.trim(),
      paidAt: new Date(),
    });

    // ==========================================
    // UPDATE TOTAL RECEIVED
    // ==========================================

    const newTotalReceived =
      totalReceived + paymentAmount;

    const newRemainingAmount =
      Math.max(
        totalAmount - newTotalReceived,
        0
      );

    purchaseOrder.receiving.totalReceived =
      newTotalReceived;

    purchaseOrder.receiving.remainingAmount =
      newRemainingAmount;

    // ==========================================
    // UPDATE RECEIVING STATUS
    // ==========================================

    if (newRemainingAmount === 0) {
      purchaseOrder.receiving.status =
        "PAID";
    } else if (newTotalReceived > 0) {
      purchaseOrder.receiving.status =
        "PARTIAL";
    } else {
      purchaseOrder.receiving.status =
        "PENDING";
    }

    // ==========================================
    // UPDATE ORDER STATUS
    // ==========================================

    if (newRemainingAmount === 0) {
      purchaseOrder.status =
        "PROCESSING";
    }

    // ==========================================
    // SAVE
    // ==========================================

    await purchaseOrder.save();

    // ==========================================
    // RETURN UPDATED PURCHASE
    // ==========================================

    const updatedOrder =
      await PurchaseOrder.findById(
        purchaseOrder._id
      )
        .populate("product")
        .populate("user");

    return res.status(200).json({
      success: true,
      message: "Payment received successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error(
      "RECORD RECEIVING PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to record receiving payment",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
  createPurchase,
  getMyPurchase,
  getPurchase,
  cancelPurchase,
  recordReceivingPayment,
  getAllPurchases,
};