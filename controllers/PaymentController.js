const Payment = require("../model/PaymentSettings");
const Order = require("../model/Order");
const User = require("../model/UserModel");
const { notify } = require("../config/NotificationService");
const axios = require("axios");
const crypto = require("crypto");


// ==========================================
// SEND ADMIN PAYMENT NOTIFICATION ONCE
// ==========================================

const sendAdminPaymentNotificationOnce = async (order) => {
  try {

    if (order.adminNotified) {
      console.log(
        "ℹ️ ADMIN ALREADY NOTIFIED FOR THIS ORDER",
      );

      return;
    }

    await notifyAdminsAboutPaidOrder(order);

    order.adminNotified = true;

    await order.save();

    console.log(
      "🔔 ADMIN NOTIFICATION SAVED AS COMPLETED",
    );

  } catch (error) {

    console.error(
      "❌ FAILED TO SEND ADMIN NOTIFICATION:",
      error.message,
    );

  }
};
// ==========================================
// GET PAYMENT SETTINGS
// ==========================================

const getPaymentSettings = async (req, res) => {
  try {
    let payment = await Payment.findOne();

    // ==========================================
    // CREATE DEFAULT SETTINGS
    // ==========================================

    if (!payment) {
      payment = await Payment.create({
        bankTransferEnabled: true,

        bankName: "",
        accountName: "",
        accountNumber: "",

        paystackEnabled: true,

        paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || "",

        paymentLinkEnabled: false,

        paymentLink: "",
      });
    }

    // ==========================================
    // RETURN SAFE DATA ONLY
    // ==========================================

    return res.status(200).json({
      success: true,

      data: {
        _id: payment._id,

        bankTransferEnabled: payment.bankTransferEnabled,

        bankName: payment.bankName,

        accountName: payment.accountName,

        accountNumber: payment.accountNumber,

        paystackEnabled: payment.paystackEnabled,

        paystackPublicKey:
          process.env.PAYSTACK_PUBLIC_KEY || payment.paystackPublicKey,

        paymentLinkEnabled: payment.paymentLinkEnabled,

        paymentLink: payment.paymentLink,
      },
    });
  } catch (error) {
    console.error("GET PAYMENT SETTINGS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payment settings",
    });
  }
};

// ==========================================
// UPDATE PAYMENT SETTINGS
// ADMIN ONLY
// ==========================================

const updatePaymentSettings = async (req, res) => {
  try {
    const {
      bankTransferEnabled,

      bankName,
      accountName,
      accountNumber,

      paystackEnabled,

      paymentLinkEnabled,
      paymentLink,
    } = req.body;

    let payment = await Payment.findOne();

    if (!payment) {
      payment = new Payment();
    }

    // ==========================================
    // BANK TRANSFER
    // ==========================================

    if (bankTransferEnabled !== undefined) {
      payment.bankTransferEnabled = bankTransferEnabled;
    }

    if (bankName !== undefined) {
      payment.bankName = bankName?.trim() || "";
    }

    if (accountName !== undefined) {
      payment.accountName = accountName?.trim() || "";
    }

    if (accountNumber !== undefined) {
      payment.accountNumber = accountNumber?.trim() || "";
    }

    // ==========================================
    // PAYSTACK
    // ==========================================

    if (paystackEnabled !== undefined) {
      payment.paystackEnabled = paystackEnabled;
    }

    payment.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY || "";

    // ==========================================
    // PAYMENT LINK
    // ==========================================

    if (paymentLinkEnabled !== undefined) {
      payment.paymentLinkEnabled = paymentLinkEnabled;
    }

    if (paymentLink !== undefined) {
      payment.paymentLink = paymentLink?.trim() || "";
    }

    // ==========================================
    // VALIDATE BANK DETAILS
    // ==========================================

    if (payment.bankTransferEnabled) {
      if (!payment.bankName) {
        return res.status(400).json({
          success: false,
          message: "Bank name is required when bank transfer is enabled",
        });
      }

      if (!payment.accountName) {
        return res.status(400).json({
          success: false,
          message: "Account name is required when bank transfer is enabled",
        });
      }

      if (!payment.accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Account number is required when bank transfer is enabled",
        });
      }
    }

    // ==========================================
    // VALIDATE PAYMENT LINK
    // ==========================================

    if (payment.paymentLinkEnabled && !payment.paymentLink) {
      return res.status(400).json({
        success: false,
        message: "Payment link is required when payment link is enabled",
      });
    }

    await payment.save();

    return res.status(200).json({
      success: true,

      message: "Payment settings saved successfully",

      data: payment,
    });
  } catch (error) {
    console.error("UPDATE PAYMENT SETTINGS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save payment settings",
    });
  }
};

// ==========================================
// INITIALIZE PAYSTACK PAYMENT
// ==========================================

const initializePaystackPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    // ==========================================
    // VALIDATE ORDER ID
    // ==========================================

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // ==========================================
    // FIND ORDER
    // ==========================================

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // SECURITY: CHECK ORDER OWNER
    // ==========================================

    // Use this if your auth middleware sets req.user
    if (req.user && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this order",
      });
    }

    // ==========================================
    // CHECK IF ALREADY PAID
    // ==========================================

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid",
      });
    }

    // ==========================================
    // CHECK CUSTOMER EMAIL
    // ==========================================

    if (!order.customer.email) {
      return res.status(400).json({
        success: false,
        message: "A customer email is required for online payment",
      });
    }

    // ==========================================
    // CHECK PAYMENT SETTINGS
    // ==========================================

    const settings = await Payment.findOne();

    if (!settings || !settings.paystackEnabled) {
      return res.status(400).json({
        success: false,
        message: "Online payment is currently unavailable",
      });
    }

    // ==========================================
    // CHECK PAYSTACK CONFIGURATION
    // ==========================================

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error("❌ PAYSTACK_SECRET_KEY IS MISSING");

      return res.status(500).json({
        success: false,
        message: "Payment service is not configured",
      });
    }

    // ==========================================
    // CREATE UNIQUE REFERENCE
    // ==========================================

    const reference = `ORD_${order._id}_${Date.now()}`;

    // ==========================================
    // SAVE PAYMENT INFORMATION
    // ==========================================

    order.paymentMethod = "online";
    order.paymentProvider = "paystack";
    order.paymentReference = reference;

    await order.save();

    // ==========================================
    // INITIALIZE PAYSTACK
    // ==========================================

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",

      {
        email: order.customer.email,

        // IMPORTANT:
        // Convert Naira to Kobo
        amount: Math.round(Number(order.total) * 100),

        reference,

        currency: "NGN",

        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,

        metadata: {
          orderId: order._id.toString(),

          customerName: order.customer.name,

          customerPhone: order.customer.phone,
        },
      },

      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

          "Content-Type": "application/json",
        },
      },
    );

    // ==========================================
    // RETURN CHECKOUT URL
    // ==========================================

    return res.status(200).json({
      success: true,

      message: "Payment initialized successfully",

      authorization_url: response.data.data.authorization_url,

      reference: response.data.data.reference,
    });
  } catch (error) {
    console.error(
      "PAYSTACK INITIALIZATION ERROR:",
      error.response?.data || error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to initialize payment",
    });
  }
};

// ==========================================
// VERIFY PAYSTACK PAYMENT
// ==========================================

const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    // ==========================================
    // FIND ORDER USING REFERENCE
    // ==========================================

    const order = await Order.findOne({
      paymentReference: reference,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found for this payment",
      });
    }

    // ==========================================
    // CHECK IF ALREADY PAID
    // ==========================================

    if (order.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment has already been verified",
        order,
      });
    }

    // ==========================================
    // VERIFY WITH PAYSTACK
    // ==========================================

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,

      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const payment = response.data.data;

    // ==========================================
    // CHECK PAYMENT STATUS
    // ==========================================

    if (payment.status !== "success") {
      order.paymentStatus = "failed";

      await order.save();

      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
      });
    }

    // ==========================================
    // VERIFY REFERENCE
    // ==========================================

    if (payment.reference !== reference) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment reference",
      });
    }

    // ==========================================
    // VERIFY AMOUNT
    // ==========================================

    const expectedAmount = Math.round(Number(order.total) * 100);

    if (payment.amount !== expectedAmount) {
      console.error("❌ PAYMENT AMOUNT MISMATCH");

      console.error("Expected:", expectedAmount);

      console.error("Received:", payment.amount);

      return res.status(400).json({
        success: false,
        message: "Payment amount verification failed",
      });
    }

    // ==========================================
    // MARK ORDER AS PAID
    // ==========================================

    order.paymentStatus = "paid";

    order.paymentMethod = "online";

    order.paymentProvider = "paystack";

    order.paymentReference = payment.reference;

    order.paidAmount = payment.amount / 100;

    order.paidAt = new Date();

    // Move order forward
    order.status = "confirmed";

    await order.save();
    await sendAdminPaymentNotificationOnce(order);
    // ==========================================
    // SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,

      message: "Payment verified successfully",

      order: {
        _id: order._id,

        paymentStatus: order.paymentStatus,

        status: order.status,

        total: order.total,
      },
    });
  } catch (error) {
    console.error(
      "PAYSTACK VERIFICATION ERROR:",
      error.response?.data || error.message,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify payment",
    });
  }
};

// ==========================================
// FORWARD LOAN TRANSFER WEBHOOK
// PRODUCT → LOAN BACKEND
// ==========================================

const forwardLoanTransferWebhook = async (event) => {
  try {
    const loanWebhookUrl = process.env.LOAN_WEBHOOK_URL;
    const loanWebhookSecret = process.env.LOAN_WEBHOOK_SECRET;

    if (!loanWebhookUrl) {
      console.error(
        "❌ LOAN_WEBHOOK_URL IS NOT CONFIGURED"
      );

      return false;
    }

    if (!loanWebhookSecret) {
      console.error(
        "❌ LOAN_WEBHOOK_SECRET IS NOT CONFIGURED"
      );

      return false;
    }

    await axios.post(
      loanWebhookUrl,
      event,
      {
        headers: {
          "Content-Type": "application/json",
          "x-loan-webhook-secret": loanWebhookSecret,
        },
        timeout: 15000,
      }
    );

    console.log(
      "✅ LOAN TRANSFER WEBHOOK FORWARDED:",
      event.event,
      event.data?.reference || null
    );

    return true;
  } catch (error) {
    console.error(
      "❌ FAILED TO FORWARD LOAN TRANSFER WEBHOOK:",
      error.response?.data || error.message
    );

    return false;
  }
};


// ==========================================
// PAYSTACK WEBHOOK
// ==========================================

const paystackWebhook = async (req, res) => {
  console.log("🔥🔥🔥 PAYSTACK WEBHOOK CONTROLLER HIT 🔥🔥🔥");
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("BODY IS BUFFER:", Buffer.isBuffer(req.body));
  try {
    // ==========================================
    // CHECK PAYSTACK SECRET KEY
    // ==========================================

    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.error(
        "❌ PAYSTACK_SECRET_KEY IS MISSING"
      );

      return res.sendStatus(500);
    }

    // ==========================================
    // CHECK RAW REQUEST BODY
    // ==========================================

    if (!Buffer.isBuffer(req.body)) {
      console.error(
        "❌ PAYSTACK WEBHOOK BODY IS NOT RAW BUFFER"
      );

      return res.sendStatus(400);
    }

    // ==========================================
    // GET PAYSTACK SIGNATURE
    // ==========================================

    const signature =
      req.headers["x-paystack-signature"];

    if (!signature) {
      console.error(
        "❌ PAYSTACK WEBHOOK SIGNATURE MISSING"
      );

      return res.sendStatus(401);
    }

    // ==========================================
    // VERIFY PAYSTACK SIGNATURE
    // IMPORTANT:
    // HASH THE EXACT RAW REQUEST BODY
    // ==========================================

    const hash = crypto
      .createHmac(
        "sha512",
        process.env.PAYSTACK_SECRET_KEY
      )
      .update(req.body)
      .digest("hex");

    if (hash !== signature) {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK SIGNATURE"
      );

      return res.sendStatus(401);
    }

    // ==========================================
    // PARSE RAW BODY
    // ==========================================

    let event;

    try {
      event = JSON.parse(
        req.body.toString("utf8")
      );
    } catch (parseError) {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK JSON:",
        parseError.message
      );

      return res.sendStatus(400);
    }

    console.log(
      "📩 PAYSTACK WEBHOOK:",
      event.event
    );

    // ==========================================
    // VALIDATE EVENT DATA
    // ==========================================

    if (!event || typeof event !== "object") {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK EVENT"
      );

      return res.sendStatus(400);
    }

    // ==========================================
    // LOAN TRANSFER EVENTS
    //
    // Paystack sends these to the PRODUCT webhook.
    // Product verifies the Paystack signature above,
    // then securely forwards the event to the LOAN backend.
    // ==========================================

    const loanTransferEvents = new Set([
      "transfer.success",
      "transfer.failed",
      "transfer.reversed",
    ]);

    if (loanTransferEvents.has(event.event)) {
      console.log(
        "🏦 LOAN TRANSFER EVENT RECEIVED:",
        event.event
      );

      // ------------------------------------------
      // CHECK TRANSFER DATA
      // ------------------------------------------

      if (!event.data) {
        console.error(
          "❌ PAYSTACK TRANSFER EVENT DATA MISSING"
        );

        // Paystack delivered a validly signed event,
        // but the payload is unusable.
        // Acknowledge it to avoid endless retries.
        return res.sendStatus(200);
      }

      // ------------------------------------------
      // LOG IMPORTANT TRANSFER IDENTIFIERS
      // ------------------------------------------

      console.log(
        "REFERENCE:",
        event.data.reference || null
      );

      console.log(
        "TRANSFER CODE:",
        event.data.transfer_code || null
      );

      console.log(
        "TRANSFER ID:",
        event.data.id || null
      );

      // ------------------------------------------
      // FORWARD TO LOAN BACKEND
      // ------------------------------------------

      const forwarded =
        await forwardLoanTransferWebhook(event);

      // ------------------------------------------
      // IMPORTANT:
      // If Product → Loan forwarding fails,
      // return 500 so Paystack can retry the webhook.
      // ------------------------------------------

      if (!forwarded) {
        console.error(
          "❌ LOAN WEBHOOK FORWARDING FAILED"
        );

        return res.sendStatus(500);
      }

      console.log(
        "✅ LOAN TRANSFER EVENT PROCESSED:",
        event.event,
        event.data.reference || null
      );

      return res.sendStatus(200);
    }

    // ==========================================
    // HANDLE SUCCESSFUL PRODUCT PAYMENT
    // ==========================================

    if (event.event === "charge.success") {
      const payment = event.data;

      if (!payment) {
        console.error(
          "❌ PAYSTACK WEBHOOK PAYMENT DATA MISSING"
        );

        return res.sendStatus(200);
      }

      const reference = payment.reference;

      if (!reference) {
        console.error(
          "❌ PAYSTACK WEBHOOK REFERENCE MISSING"
        );

        return res.sendStatus(200);
      }

      // ==========================================
      // FIND ORDER
      // ==========================================

      const order = await Order.findOne({
        paymentReference: reference,
      });

      if (!order) {
        console.log(
          "⚠️ ORDER NOT FOUND:",
          reference
        );

        // This may simply be a transaction belonging
        // to another system, so acknowledge it.
        return res.sendStatus(200);
      }

      // ==========================================
      // PREVENT DUPLICATE PROCESSING
      // ==========================================

      if (order.paymentStatus === "paid") {
        console.log(
          "ℹ️ PAYMENT ALREADY PROCESSED:",
          reference
        );

        return res.sendStatus(200);
      }

      // ==========================================
      // VERIFY PAYMENT REFERENCE
      // ==========================================

      if (
        payment.reference !==
        order.paymentReference
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT REFERENCE MISMATCH"
        );

        console.error({
          expected: order.paymentReference,
          received: payment.reference,
        });

        return res.sendStatus(200);
      }

      // ==========================================
      // VERIFY PAYMENT AMOUNT
      // ==========================================

      const expectedAmount = Math.round(
        Number(order.total) * 100
      );

      if (
        Number(payment.amount) !==
        expectedAmount
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT AMOUNT MISMATCH"
        );

        console.error({
          expected: expectedAmount,
          received: payment.amount,
          reference,
        });

        return res.sendStatus(200);
      }

      // ==========================================
      // VERIFY PAYMENT CURRENCY
      // ==========================================

      if (
        payment.currency &&
        payment.currency !== "NGN"
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT CURRENCY MISMATCH"
        );

        console.error({
          expected: "NGN",
          received: payment.currency,
          reference,
        });

        return res.sendStatus(200);
      }

      // ==========================================
      // MARK ORDER AS PAID
      // ==========================================

      order.paymentStatus = "paid";

      order.paymentMethod = "online";

      order.paymentProvider = "paystack";

      order.paymentReference =
        payment.reference;

      order.paidAmount =
        Number(payment.amount) / 100;

      order.paidAt = new Date();

      order.status = "confirmed";

      await order.save();

      // ==========================================
      // NOTIFY ADMINS
      // ==========================================

      await sendAdminPaymentNotificationOnce(
        order
      );

      console.log(
        `✅ ORDER ${order._id} PAYMENT CONFIRMED`
      );
    }

    // ==========================================
    // OTHER PAYSTACK EVENTS
    // ==========================================

    return res.sendStatus(200);

  } catch (error) {
    console.error(
      "❌ PAYSTACK WEBHOOK ERROR:",
      error.response?.data ||
      error.message
    );

    return res.sendStatus(500);
  }
};

// ==========================================
// NOTIFY ADMINS ABOUT PAID ORDER
// ==========================================

const notifyAdminsAboutPaidOrder = async (order) => {
  try {
    // ==========================================
    // FIND ADMIN USERS
    // ==========================================

    const admins = await User.find({
      isAdmin: true,
    }).select("_id");

    if (!admins.length) {
      console.log(
        "⚠️ NO ADMIN USERS FOUND FOR PAYMENT NOTIFICATION",
      );

      return;
    }

    // ==========================================
    // GET PRODUCT NAMES
    // ==========================================

    const productNames = order.items
      .map((item) => item.name)
      .join(", ");

    // ==========================================
    // CREATE NOTIFICATION FOR EVERY ADMIN
    // ==========================================

    await Promise.all(
      admins.map((admin) =>
        notify({
          user: admin._id,

          sender: order.user,

          type: "order",

          orderId: order._id,

          message:
            `💰 New paid order received from ${order.customer.name}. ` +
            `Products: ${productNames}. ` +
            `Total: ₦${Number(order.total).toLocaleString()}`,
        }),
      ),
    );

    console.log(
      `🔔 ADMIN NOTIFICATIONS SENT: ${admins.length}`,
    );

  } catch (error) {
    // IMPORTANT:
    // Payment should NOT fail because notification failed

    console.error(
      "❌ ADMIN NOTIFICATION ERROR:",
      error.message,
    );
  }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  getPaymentSettings,
  forwardLoanTransferWebhook,
  updatePaymentSettings,

  initializePaystackPayment,

  verifyPaystackPayment,

  paystackWebhook,
  notifyAdminsAboutPaidOrder,
  sendAdminPaymentNotificationOnce,
};
