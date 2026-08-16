const PurchaseOrder = require("../model/PurchaseOrder");

/**
 * @desc    Get purchase orders for admin receiving point
 * @route   GET /api/admin/purchase-orders
 * @access  Admin
 */
const getReceivingPurchases = async (req, res) => {
  try {
    const purchases = await PurchaseOrder.find({
      status: {
        $in: [
          "PENDING_PAYMENT",
          "CONTRIBUTION_ACTIVE",
          "PENDING_LOAN_APPROVAL",
          "LOAN_APPROVED",
          "PROCESSING",
        ],
      },
    })
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
      "GET RECEIVING PURCHASES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch receiving purchases",
    });
  }
};


/**
 * @desc    Get one purchase for receiving
 * @route   GET /api/admin/purchase-orders/:id
 * @access  Admin
 */
const getReceivingPurchase = async (req, res) => {
  try {
    const purchase = await PurchaseOrder.findById(
      req.params.id
    )
      .populate("user", "name email phone")
      .populate(
        "product",
        "name price image stock"
      )
      .populate(
        "receiving.payments.receivedBy",
        "name email"
      );

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error(
      "GET RECEIVING PURCHASE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch purchase order",
    });
  }
};


/**
 * @desc    Receive payment
 * @route   POST /api/admin/purchase-orders/:id/receive
 * @access  Admin
 */
const receivePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentMethod,
      reference = "",
      note = "",
    } = req.body;

    const receivedAmount = Number(amount);

    // ==========================================
    // VALIDATE AMOUNT
    // ==========================================

    if (
      !Number.isFinite(receivedAmount) ||
      receivedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero",
      });
    }

    // ==========================================
    // VALIDATE PAYMENT METHOD
    // ==========================================

    const allowedMethods = [
      "CASH",
      "BANK_TRANSFER",
      "CARD",
      "ONLINE",
      "OTHER",
    ];

    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // ==========================================
    // FIND PURCHASE
    // ==========================================

    const purchase =
      await PurchaseOrder.findById(
        req.params.id
      );

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    // ==========================================
    // CURRENT TOTALS
    // ==========================================

    const currentReceived = Number(
      purchase.receiving?.totalReceived || 0
    );

    const totalAmount = Number(
      purchase.totalAmount || 0
    );

    const currentRemaining = Math.max(
      totalAmount - currentReceived,
      0
    );

    // ==========================================
    // PREVENT OVERPAYMENT
    // ==========================================

    if (receivedAmount > currentRemaining) {
      return res.status(400).json({
        success: false,
        message: `Maximum receivable amount is ₦${currentRemaining.toLocaleString()}`,
      });
    }

    // ==========================================
    // INITIALIZE RECEIVING
    // ==========================================

    if (!purchase.receiving) {
      purchase.receiving = {
        totalReceived: 0,
        remainingAmount: totalAmount,
        payments: [],
        status: "PENDING",
      };
    }

    // ==========================================
    // ADD PAYMENT
    // ==========================================

    purchase.receiving.payments.push({
      receivedAmount,
      paymentMethod,
      reference,
      note,
      receivedBy: req.user._id,
      receivedAt: new Date(),
    });

    // ==========================================
    // UPDATE TOTALS
    // ==========================================

    const newTotalReceived =
      currentReceived + receivedAmount;

    const newRemaining = Math.max(
      totalAmount - newTotalReceived,
      0
    );

    purchase.receiving.totalReceived =
      newTotalReceived;

    purchase.receiving.remainingAmount =
      newRemaining;

    // ==========================================
    // RECEIVING STATUS
    // ==========================================

    if (newRemaining === 0) {
      purchase.receiving.status = "PAID";
    } else if (newTotalReceived > 0) {
      purchase.receiving.status = "PARTIAL";
    } else {
      purchase.receiving.status = "PENDING";
    }

    // ==========================================
    // UPDATE PURCHASE TYPE
    // ==========================================

    if (
      purchase.purchaseType ===
      "CONTRIBUTION"
    ) {
      if (purchase.contribution) {
        purchase.contribution.paidAmount =
          newTotalReceived;

        purchase.contribution.remainingAmount =
          newRemaining;

        const phases =
          purchase.contribution.phases;

        const amountPerPhase =
          purchase.contribution.amountPerPhase;

        const completedPhases = Math.min(
          Math.floor(
            newTotalReceived /
              amountPerPhase
          ),
          phases
        );

        purchase.contribution.currentPhase =
          completedPhases;

        if (newRemaining === 0) {
          purchase.contribution.status =
            "COMPLETED";

          purchase.status = "COMPLETED";

          purchase.completedAt = new Date();
        } else {
          purchase.contribution.status =
            "ACTIVE";

          purchase.status =
            "CONTRIBUTION_ACTIVE";
        }
      }
    }

    // ==========================================
    // FULL PAYMENT
    // ==========================================

    if (
      purchase.purchaseType ===
      "FULL_PAYMENT"
    ) {
      if (purchase.payment) {
        purchase.payment.paidAmount =
          newTotalReceived;

        purchase.payment.remainingAmount =
          newRemaining;

        if (newRemaining === 0) {
          purchase.payment.status = "PAID";

          purchase.status = "PROCESSING";
        } else {
          purchase.payment.status = "PARTIAL";

          purchase.status =
            "PENDING_PAYMENT";
        }
      }
    }

    // ==========================================
    // RESELLER
    // ==========================================

    if (
      purchase.purchaseType ===
      "RESELLER"
    ) {
      if (purchase.reseller) {
        if (newRemaining === 0) {
          purchase.reseller.status =
            "PAID";

          purchase.status = "PROCESSING";
        } else {
          purchase.reseller.status =
            "PENDING";

          purchase.status =
            "PENDING_PAYMENT";
        }
      }
    }

    // ==========================================
    // SAVE
    // ==========================================

    await purchase.save();

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Payment received successfully",
      data: purchase,
    });
  } catch (error) {
    console.error(
      "RECEIVE PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to receive payment",
    });
  }
};


module.exports = {
  getReceivingPurchases,
  getReceivingPurchase,
  receivePayment,
};