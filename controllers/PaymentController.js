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
      console.log("ℹ️ ADMIN ALREADY NOTIFIED FOR THIS ORDER");

      return;
    }

    await notifyAdminsAboutPaidOrder(order);

    order.adminNotified = true;

    await order.save();

    console.log("🔔 ADMIN NOTIFICATION SAVED AS COMPLETED");
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

    if (!payment) {
      payment = await Payment.create({
        bankTransferEnabled: true,

        bankName: "",
        accountName: "",
        accountNumber: "",

        paystackEnabled: true,

        paystackPublicKey:
          process.env.PAYSTACK_PUBLIC_KEY || "",

        paymentLinkEnabled: false,

        paymentLink: "",
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        _id: payment._id,

        bankTransferEnabled:
          payment.bankTransferEnabled,

        bankName: payment.bankName,

        accountName: payment.accountName,

        accountNumber: payment.accountNumber,

        paystackEnabled:
          payment.paystackEnabled,

        paystackPublicKey:
          process.env.PAYSTACK_PUBLIC_KEY ||
          payment.paystackPublicKey,

        paymentLinkEnabled:
          payment.paymentLinkEnabled,

        paymentLink: payment.paymentLink,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYMENT SETTINGS ERROR:",
      error,
    );

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

    if (
      bankTransferEnabled !== undefined
    ) {
      payment.bankTransferEnabled =
        bankTransferEnabled;
    }

    if (bankName !== undefined) {
      payment.bankName =
        bankName?.trim() || "";
    }

    if (accountName !== undefined) {
      payment.accountName =
        accountName?.trim() || "";
    }

    if (accountNumber !== undefined) {
      payment.accountNumber =
        accountNumber?.trim() || "";
    }

    // ==========================================
    // PAYSTACK
    // ==========================================

    if (paystackEnabled !== undefined) {
      payment.paystackEnabled =
        paystackEnabled;
    }

    payment.paystackPublicKey =
      process.env.PAYSTACK_PUBLIC_KEY || "";

    // ==========================================
    // PAYMENT LINK
    // ==========================================

    if (
      paymentLinkEnabled !== undefined
    ) {
      payment.paymentLinkEnabled =
        paymentLinkEnabled;
    }

    if (paymentLink !== undefined) {
      payment.paymentLink =
        paymentLink?.trim() || "";
    }

    // ==========================================
    // VALIDATE BANK DETAILS
    // ==========================================

    if (payment.bankTransferEnabled) {
      if (!payment.bankName) {
        return res.status(400).json({
          success: false,
          message:
            "Bank name is required when bank transfer is enabled",
        });
      }

      if (!payment.accountName) {
        return res.status(400).json({
          success: false,
          message:
            "Account name is required when bank transfer is enabled",
        });
      }

      if (!payment.accountNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Account number is required when bank transfer is enabled",
        });
      }
    }

    // ==========================================
    // VALIDATE PAYMENT LINK
    // ==========================================

    if (
      payment.paymentLinkEnabled &&
      !payment.paymentLink
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment link is required when payment link is enabled",
      });
    }

    await payment.save();

    return res.status(200).json({
      success: true,

      message:
        "Payment settings saved successfully",

      data: payment,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYMENT SETTINGS ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to save payment settings",
    });
  }
};

// ==========================================
// INITIALIZE PAYSTACK PAYMENT
// ==========================================

const initializePaystackPayment = async (
  req,
  res,
) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      req.user &&
      order.user.toString() !==
        req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to pay for this order",
      });
    }

    if (
      order.paymentStatus === "paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This order has already been paid",
      });
    }

    if (!order.customer.email) {
      return res.status(400).json({
        success: false,
        message:
          "A customer email is required for online payment",
      });
    }

    const settings =
      await Payment.findOne();

    if (
      !settings ||
      !settings.paystackEnabled
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Online payment is currently unavailable",
      });
    }

    if (
      !process.env.PAYSTACK_SECRET_KEY
    ) {
      console.error(
        "❌ PAYSTACK_SECRET_KEY IS MISSING",
      );

      return res.status(500).json({
        success: false,
        message:
          "Payment service is not configured",
      });
    }

    const reference =
      `ORD_${order._id}_${Date.now()}`;

    order.paymentMethod = "online";

    order.paymentProvider = "paystack";

    order.paymentReference =
      reference;

    await order.save();

    const response =
      await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email:
            order.customer.email,

          amount:
            Math.round(
              Number(order.total) * 100,
            ),

          reference,

          currency: "NGN",

          callback_url:
            `${process.env.FRONTEND_URL}/payment/callback`,

          metadata: {
            orderId:
              order._id.toString(),

            customerName:
              order.customer.name,

            customerPhone:
              order.customer.phone,
          },
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

            "Content-Type":
              "application/json",
          },
        },
      );

    return res.status(200).json({
      success: true,

      message:
        "Payment initialized successfully",

      authorization_url:
        response.data.data
          .authorization_url,

      reference:
        response.data.data.reference,
    });
  } catch (error) {
    console.error(
      "PAYSTACK INITIALIZATION ERROR:",
      error.response?.data ||
        error.message,
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to initialize payment",
    });
  }
};

// ==========================================
// VERIFY PAYSTACK PAYMENT
// ==========================================

const verifyPaystackPayment = async (
  req,
  res,
) => {
  try {
    const { reference } =
      req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message:
          "Payment reference is required",
      });
    }

    const order =
      await Order.findOne({
        paymentReference: reference,
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found for this payment",
      });
    }

    if (
      order.paymentStatus === "paid"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "Payment has already been verified",
        order,
      });
    }

    const response =
      await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

    const payment =
      response.data.data;

    if (payment.status !== "success") {
      order.paymentStatus =
        "failed";

      await order.save();

      return res.status(400).json({
        success: false,
        message:
          "Payment was not successful",
      });
    }

    if (
      payment.reference !==
      reference
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment reference",
      });
    }

    const expectedAmount =
      Math.round(
        Number(order.total) * 100,
      );

    if (
      payment.amount !==
      expectedAmount
    ) {
      console.error(
        "❌ PAYMENT AMOUNT MISMATCH",
      );

      console.error(
        "Expected:",
        expectedAmount,
      );

      console.error(
        "Received:",
        payment.amount,
      );

      return res.status(400).json({
        success: false,
        message:
          "Payment amount verification failed",
      });
    }

    order.paymentStatus =
      "paid";

    order.paymentMethod =
      "online";

    order.paymentProvider =
      "paystack";

    order.paymentReference =
      payment.reference;

    order.paidAmount =
      payment.amount / 100;

    order.paidAt =
      new Date();

    order.status =
      "confirmed";

    await order.save();

    await sendAdminPaymentNotificationOnce(
      order,
    );

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully",

      order: {
        _id: order._id,

        paymentStatus:
          order.paymentStatus,

        status:
          order.status,

        total:
          order.total,
      },
    });
  } catch (error) {
    console.error(
      "PAYSTACK VERIFICATION ERROR:",
      error.response?.data ||
        error.message,
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify payment",
    });
  }
};

// ==========================================
// FORWARD LOAN TRANSFER WEBHOOK
// PRODUCT → LOAN BACKEND
// ==========================================

const forwardLoanTransferWebhook =
  async (event) => {
    try {
      const loanWebhookUrl =
        process.env.LOAN_WEBHOOK_URL;

      const loanWebhookSecret =
        process.env.LOAN_WEBHOOK_SECRET;

      if (!loanWebhookUrl) {
        console.error(
          "❌ LOAN_WEBHOOK_URL IS NOT CONFIGURED",
        );

        return false;
      }

      if (!loanWebhookSecret) {
        console.error(
          "❌ LOAN_WEBHOOK_SECRET IS NOT CONFIGURED",
        );

        return false;
      }

      await axios.post(
        loanWebhookUrl,
        event,
        {
          headers: {
            "Content-Type":
              "application/json",

            "x-loan-webhook-secret":
              loanWebhookSecret,

            "x-webhook-type":
              "loan-transfer",
          },

          timeout: 15000,
        },
      );

      console.log(
        "✅ LOAN TRANSFER WEBHOOK FORWARDED:",
        event.event,
        event.data?.reference ||
          null,
      );

      return true;
    } catch (error) {
      console.error(
        "❌ FAILED TO FORWARD LOAN TRANSFER WEBHOOK:",
        error.response?.data ||
          error.message,
      );

      return false;
    }
  };

// ==========================================
// FORWARD LOAN DVA WEBHOOK
// PRODUCT → LOAN BACKEND
// ==========================================

const forwardLoanDvaWebhook = async (event) => {
  try {
    const loanDvaWebhookUrl =
      process.env.LOAN_DVA_WEBHOOK_URL;

    const loanWebhookSecret =
      process.env.LOAN_WEBHOOK_SECRET;

    console.log(
      "=================================",
    );

    console.log(
      "🏦 LOAN DVA WEBHOOK FORWARD",
    );

    console.log(
      "EVENT:",
      event?.event,
    );

    // =====================================================
    // EXTRACT PAYSTACK DVA DATA
    // =====================================================

    const customerCode =
      event?.data?.customer_code ||
      event?.data?.customer?.customer_code ||
      null;

    const accountNumber =
      event?.data?.account_number ||
      event?.data?.account?.account_number ||
      event?.data?.dedicated_account?.account_number ||
      null;

    const accountId =
      event?.data?.id ||
      event?.data?.dedicated_account_id ||
      event?.data?.account_id ||
      event?.data?.dedicated_account?.id ||
      null;

    const message =
      event?.data?.message ||
      event?.data?.dedicated_account?.message ||
      event?.message ||
      null;

    const reason =
      event?.data?.reason ||
      event?.data?.failure_reason ||
      event?.data?.dedicated_account?.reason ||
      event?.data?.dedicated_account?.failure_reason ||
      event?.reason ||
      message ||
      null;

    // =====================================================
    // DEBUG PAYSTACK DVA FAILURE
    // =====================================================

    if (
      event?.event ===
      "dedicatedaccount.assign.failed"
    ) {
      console.log(
        "========== PAYSTACK DVA FAILURE PAYLOAD ==========",
      );

      console.dir(event, {
        depth: null,
      });

      console.log(
        "==================================================",
      );
    }

    console.log(
      "TARGET URL:",
      loanDvaWebhookUrl ||
        "NOT CONFIGURED",
    );

    console.log(
      "CUSTOMER CODE:",
      customerCode,
    );

    console.log(
      "ACCOUNT NUMBER:",
      accountNumber,
    );

    console.log(
      "ACCOUNT ID:",
      accountId,
    );

    console.log(
      "MESSAGE:",
      message,
    );

    console.log(
      "REASON:",
      reason,
    );

    console.log(
      "SECRET PRESENT:",
      !!loanWebhookSecret,
    );

    console.log(
      "=================================",
    );

    // =====================================================
    // VALIDATE CONFIG
    // =====================================================

    if (!loanDvaWebhookUrl) {
      console.error(
        "❌ LOAN_DVA_WEBHOOK_URL IS NOT CONFIGURED",
      );

      return false;
    }

    if (!loanWebhookSecret) {
      console.error(
        "❌ LOAN_WEBHOOK_SECRET IS NOT CONFIGURED",
      );

      return false;
    }

    // =====================================================
    // ONLY FORWARD LOAN DVA EVENTS
    // =====================================================

    const supportedEvents = new Set([
      "dedicatedaccount.assign.success",
      "dedicatedaccount.assign.failed",
    ]);

    if (!supportedEvents.has(event?.event)) {
      console.log(
        "ℹ️ EVENT IS NOT A LOAN DVA EVENT:",
        event?.event,
      );

      return false;
    }

    // =====================================================
    // FORWARD TO LOAN
    // =====================================================

    const response = await axios.post(
      loanDvaWebhookUrl,
      event,
      {
        headers: {
          "Content-Type":
            "application/json",

          "x-loan-webhook-secret":
            loanWebhookSecret,

          "x-webhook-type":
            "loan-dva",

          "x-webhook-event-type":
            event.event,
        },

        timeout: 15000,
      },
    );

    console.log(
      "✅ LOAN DVA WEBHOOK FORWARDED:",
      event.event,
    );

    console.log(
      "LOAN RESPONSE STATUS:",
      response.status,
    );

    return true;
  } catch (error) {
    console.error(
      "❌ FAILED TO FORWARD LOAN DVA WEBHOOK:",
      error.response?.data ||
        error.message,
    );

    return false;
  }
};

// ==========================================
// FORWARD KYC VERIFICATION WEBHOOK
// PRODUCT → LOAN BACKEND
// ==========================================

const forwardKycVerificationWebhook =
  async (event) => {
    try {
      const loanKycWebhookUrl =
        process.env.LOAN_KYC_WEBHOOK_URL;

      const loanWebhookSecret =
        process.env.LOAN_WEBHOOK_SECRET;

      console.log(
        "=================================",
      );

      console.log(
        "🪪 KYC WEBHOOK FORWARD",
      );

      console.log(
        "EVENT:",
        event?.event,
      );

      console.log(
        "TARGET URL:",
        loanKycWebhookUrl ||
          "NOT CONFIGURED",
      );

      console.log(
        "SECRET PRESENT:",
        !!loanWebhookSecret,
      );

      console.log(
        "=================================",
      );

      if (!loanKycWebhookUrl) {
        console.error(
          "❌ LOAN_KYC_WEBHOOK_URL IS NOT CONFIGURED",
        );

        return false;
      }

      if (!loanWebhookSecret) {
        console.error(
          "❌ LOAN_WEBHOOK_SECRET IS NOT CONFIGURED",
        );

        return false;
      }

      await axios.post(
        loanKycWebhookUrl,
        event,
        {
          headers: {
            "Content-Type":
              "application/json",

            "x-loan-webhook-secret":
              loanWebhookSecret,

            "x-webhook-type":
              "kyc",
          },

          timeout: 15000,
        },
      );

      console.log(
        "✅ KYC VERIFICATION WEBHOOK FORWARDED:",
        event.event,
        event.data?.customer_code ||
          event.data?.customer?.customer_code ||
          event.data?.reference ||
          event.data
            ?.customer_identification_reference ||
          null,
      );

      return true;
    } catch (error) {
      console.error(
        "❌ FAILED TO FORWARD KYC VERIFICATION WEBHOOK:",
        error.response?.data ||
          error.message,
      );

      return false;
    }
  };

const forwardLoanRepaymentWebhook = async (event) => {
  try {
    const loanRepaymentWebhookUrl =
      process.env.LOAN_REPAYMENT_WEBHOOK_URL;

    const loanWebhookSecret =
      process.env.LOAN_WEBHOOK_SECRET;

    if (!loanRepaymentWebhookUrl) {
      console.error(
        "❌ LOAN_REPAYMENT_WEBHOOK_URL IS NOT CONFIGURED",
      );

      return false;
    }

    if (!loanWebhookSecret) {
      console.error(
        "❌ LOAN_WEBHOOK_SECRET IS NOT CONFIGURED",
      );

      return false;
    }

    console.log(
      "➡️ FORWARDING LOAN REPAYMENT WEBHOOK",
    );

    console.log(
      "➡️ LOAN WEBHOOK URL:",
      loanRepaymentWebhookUrl,
    );

    console.log(
      "➡️ REPAYMENT REFERENCE:",
      event?.data?.reference || null,
    );

    const response = await axios.post(
      loanRepaymentWebhookUrl,
      event,
      {
        headers: {
          "Content-Type": "application/json",
          "x-loan-webhook-secret":
            loanWebhookSecret,
          "x-webhook-type":
            "loan-repayment",
        },

        timeout: 15000,

        // Don't let Axios hide the actual HTTP response.
        validateStatus: () => true,
      },
    );

    console.log(
      "⬅️ LOAN WEBHOOK RESPONSE STATUS:",
      response.status,
    );

    console.log(
      "⬅️ LOAN WEBHOOK RESPONSE DATA:",
      response.data,
    );

    console.log(
      "⬅️ LOAN WEBHOOK RESPONSE HEADERS:",
      response.headers,
    );

    if (
      response.status >= 200 &&
      response.status < 300
    ) {
      console.log(
        "✅ LOAN REPAYMENT WEBHOOK FORWARDED:",
        event?.data?.reference || null,
      );

      return true;
    }

    console.error(
      "❌ LOAN REPAYMENT WEBHOOK REJECTED",
    );

    return false;
  } catch (error) {
    console.error(
      "❌ FAILED TO FORWARD LOAN REPAYMENT WEBHOOK",
    );

    console.error(
      "ERROR CODE:",
      error.code || null,
    );

    console.error(
      "STATUS:",
      error.response?.status || null,
    );

    console.error(
      "STATUS TEXT:",
      error.response?.statusText || null,
    );

    console.error(
      "URL:",
      error.config?.url || null,
    );

    console.error(
      "RESPONSE HEADERS:",
      error.response?.headers || null,
    );

    console.error(
      "RESPONSE DATA:",
      error.response?.data || null,
    );

    console.error(
      "ERROR MESSAGE:",
      error.message || null,
    );

    return false;
  }
};

// ==========================================
// PAYSTACK WEBHOOK
// ==========================================

const paystackWebhook = async (
  req,
  res,
) => {
  console.log(
    "🔥🔥🔥 PAYSTACK WEBHOOK CONTROLLER HIT 🔥🔥🔥",
  );

  console.log(
    "METHOD:",
    req.method,
  );

  console.log(
    "URL:",
    req.originalUrl,
  );

  console.log(
    "BODY IS BUFFER:",
    Buffer.isBuffer(req.body),
  );

  try {
    // ==========================================
    // CHECK PAYSTACK SECRET KEY
    // ==========================================

    if (
      !process.env.PAYSTACK_SECRET_KEY
    ) {
      console.error(
        "❌ PAYSTACK_SECRET_KEY IS MISSING",
      );

      return res.sendStatus(500);
    }

    // ==========================================
    // CHECK RAW REQUEST BODY
    // ==========================================

    if (!Buffer.isBuffer(req.body)) {
      console.error(
        "❌ PAYSTACK WEBHOOK BODY IS NOT RAW BUFFER",
      );

      return res.sendStatus(400);
    }

    // ==========================================
    // GET PAYSTACK SIGNATURE
    // ==========================================

    const signature =
      req.headers[
        "x-paystack-signature"
      ];

    if (!signature) {
      console.error(
        "❌ PAYSTACK WEBHOOK SIGNATURE MISSING",
      );

      return res.sendStatus(401);
    }

    // ==========================================
    // VERIFY PAYSTACK SIGNATURE
    // ==========================================

    const hash = crypto
      .createHmac(
        "sha512",
        process.env.PAYSTACK_SECRET_KEY,
      )
      .update(req.body)
      .digest("hex");

    if (hash !== signature) {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK SIGNATURE",
      );

      return res.sendStatus(401);
    }

    console.log(
      "✅ PAYSTACK WEBHOOK SIGNATURE VERIFIED",
    );

    // ==========================================
    // PARSE RAW BODY
    // ==========================================

    let event;

    try {
      event = JSON.parse(
        req.body.toString("utf8"),
      );
    } catch (parseError) {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK JSON:",
        parseError.message,
      );

      return res.sendStatus(400);
    }

    // ==========================================
    // VALIDATE EVENT
    // ==========================================

    if (
      !event ||
      typeof event !== "object"
    ) {
      console.error(
        "❌ INVALID PAYSTACK WEBHOOK EVENT",
      );

      return res.sendStatus(400);
    }

    console.log(
      "📩 PAYSTACK WEBHOOK:",
      event.event,
    );

    // ==========================================
    // LOAN TRANSFER EVENTS
    // ==========================================

    const loanTransferEvents =
      new Set([
        "transfer.success",
        "transfer.failed",
        "transfer.reversed",
      ]);

    if (
      loanTransferEvents.has(
        event.event,
      )
    ) {
      console.log(
        "🏦 LOAN TRANSFER EVENT RECEIVED:",
        event.event,
      );

      if (!event.data) {
        console.error(
          "❌ PAYSTACK TRANSFER EVENT DATA MISSING",
        );

        return res.sendStatus(200);
      }

      console.log(
        "REFERENCE:",
        event.data.reference ||
          null,
      );

      console.log(
        "TRANSFER CODE:",
        event.data.transfer_code ||
          null,
      );

      console.log(
        "TRANSFER ID:",
        event.data.id ||
          null,
      );

      const forwarded =
        await forwardLoanTransferWebhook(
          event,
        );

      if (!forwarded) {
        console.error(
          "❌ LOAN TRANSFER WEBHOOK FORWARDING FAILED",
        );

        return res.sendStatus(500);
      }

      console.log(
        "✅ LOAN TRANSFER EVENT PROCESSED:",
        event.event,
        event.data.reference ||
          null,
      );

      return res.sendStatus(200);
    }

    // ==========================================
    // LOAN DVA EVENTS
    // ==========================================

    const loanDvaEvents =
      new Set([
        "dedicatedaccount.assign.success",
        "dedicatedaccount.assign.failed",
      ]);

    if (
      loanDvaEvents.has(
        event.event,
      )
    ) {
      console.log(
        "🏦 LOAN DVA EVENT RECEIVED:",
        event.event,
      );

      if (!event.data) {
        console.error(
          "❌ PAYSTACK DVA EVENT DATA MISSING",
        );

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // LOG DVA IDENTIFIERS
      // ------------------------------------------

      console.log(
        "CUSTOMER CODE:",
        event.data.customer_code ||
          event.data.customer?.customer_code ||
          null,
      );

      console.log(
        "ACCOUNT NUMBER:",
        event.data.account_number ||
          event.data.account?.account_number ||
          null,
      );

      console.log(
        "ACCOUNT ID:",
        event.data.id ||
          event.data.account?.id ||
          null,
      );

      console.log(
        "ERROR:",
        event.data.error ||
          event.data.message ||
          event.data.reason ||
          null,
      );

      // ------------------------------------------
      // FORWARD TO LOAN BACKEND
      // ------------------------------------------

      const forwarded =
        await forwardLoanDvaWebhook(
          event,
        );

      if (!forwarded) {
        console.error(
          "❌ LOAN DVA WEBHOOK FORWARDING FAILED",
        );

        return res.sendStatus(500);
      }

      console.log(
        "✅ LOAN DVA EVENT PROCESSED:",
        event.event,
      );

      return res.sendStatus(200);
    }

    // ==========================================
    // CUSTOMER IDENTIFICATION EVENTS
    // ==========================================

    const customerIdentificationEvents =
      new Set([
        "customeridentification.success",
        "customeridentification.failed",
      ]);

    if (
      customerIdentificationEvents.has(
        event.event,
      )
    ) {
      console.log(
        "🪪 CUSTOMER IDENTIFICATION EVENT RECEIVED:",
        event.event,
      );

      if (!event.data) {
        console.error(
          "❌ PAYSTACK CUSTOMER IDENTIFICATION DATA MISSING",
        );

        return res.sendStatus(200);
      }

      console.log(
        "CUSTOMER CODE:",
        event.data.customer_code ||
          event.data.customer?.customer_code ||
          null,
      );

      console.log(
        "REFERENCE:",
        event.data.reference ||
          event.data
            .customer_identification_reference ||
          null,
      );

      console.log(
        "IDENTIFICATION STATUS:",
        event.data.status ||
          event.data.verification_status ||
          null,
      );

      const forwarded =
        await forwardKycVerificationWebhook(
          event,
        );

      if (!forwarded) {
        console.error(
          "❌ KYC WEBHOOK FORWARDING FAILED",
        );

        return res.sendStatus(500);
      }

      console.log(
        "✅ CUSTOMER IDENTIFICATION EVENT PROCESSED:",
        event.event,
      );

      return res.sendStatus(200);
    }

    // ==========================================
    // HANDLE SUCCESSFUL PAYSTACK CHARGE
    // ==========================================

    if (
      event.event ===
      "charge.success"
    ) {
      const payment =
        event.data;

      // ------------------------------------------
      // CHECK PAYMENT DATA
      // ------------------------------------------

      if (!payment) {
        console.error(
          "❌ PAYSTACK WEBHOOK PAYMENT DATA MISSING",
        );

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // GET PAYMENT REFERENCE
      // ------------------------------------------

      const reference =
        payment.reference;

      if (!reference) {
        console.error(
          "❌ PAYSTACK WEBHOOK REFERENCE MISSING",
        );

        return res.sendStatus(200);
      }

      console.log(
        "💳 CHARGE.SUCCESS REFERENCE:",
        reference,
      );

      console.log(
        "💰 CHARGE AMOUNT:",
        Number(payment.amount) / 100,
      );

      console.log(
        "💱 CHARGE CURRENCY:",
        payment.currency ||
          null,
      );

      console.log(
        "📊 CHARGE STATUS:",
        payment.status ||
          null,
      );

      console.log(
        "🆔 PAYSTACK TRANSACTION ID:",
        payment.id ||
          null,
      );

      // ==========================================
      // LOAN REPAYMENT
      //
      // Example:
      //
      // REPAY-LN-1790436634977-5938-...
      //
      // IMPORTANT:
      // This MUST happen before Order.findOne()
      // because loan repayments are not Orders.
      // ==========================================

      if (
        String(reference).startsWith(
          "REPAY-LN-",
        )
      ) {
        console.log(
          "🏦 LOAN REPAYMENT CHARGE SUCCESS:",
          reference,
        );

        // ----------------------------------------
        // VERIFY PAYSTACK STATUS
        // ----------------------------------------

        if (
          payment.status &&
          payment.status !==
            "success"
        ) {
          console.error(
            "❌ LOAN REPAYMENT PAYMENT STATUS IS NOT SUCCESS:",
            payment.status,
          );

          return res.sendStatus(200);
        }

        // ----------------------------------------
        // VERIFY CURRENCY
        // ----------------------------------------

        if (
          payment.currency &&
          payment.currency !==
            "NGN"
        ) {
          console.error(
            "❌ LOAN REPAYMENT CURRENCY MISMATCH",
          );

          console.error({
            expected: "NGN",
            received:
              payment.currency,
            reference,
          });

          return res.sendStatus(200);
        }

        // ----------------------------------------
        // VERIFY PURPOSE
        // ----------------------------------------

        const purpose =
          payment.metadata?.purpose;

        if (
          purpose &&
          purpose !==
            "LOAN_REPAYMENT"
        ) {
          console.error(
            "❌ INVALID LOAN REPAYMENT PURPOSE:",
            purpose,
          );

          return res.sendStatus(200);
        }

        console.log(
          "🎯 REPAYMENT PURPOSE:",
          purpose ||
            "LOAN_REPAYMENT",
        );

        // ----------------------------------------
        // LOG METADATA
        // ----------------------------------------

        console.log(
          "📦 LOAN REPAYMENT METADATA:",
          {
            mandateReference:
              payment.metadata
                ?.mandateReference ||
              null,

            userId:
              payment.metadata
                ?.userId ||
              null,

            loanOfferId:
              payment.metadata
                ?.loanOfferId ||
              null,

            loanApplicationId:
              payment.metadata
                ?.loanApplicationId ||
              null,

            purpose:
              payment.metadata
                ?.purpose ||
              null,
          },
        );

        // ----------------------------------------
        // FORWARD TO LOAN BACKEND
        // ----------------------------------------

        const forwarded =
          await forwardLoanRepaymentWebhook(
            event,
          );

        if (!forwarded) {
          console.error(
            "❌ LOAN REPAYMENT WEBHOOK FORWARDING FAILED:",
            reference,
          );

          /*
           * Return 500 so Paystack can retry
           * the webhook.
           */

          return res.sendStatus(500);
        }

        console.log(
          "✅ LOAN REPAYMENT WEBHOOK FORWARDED:",
          reference,
        );

        return res.sendStatus(200);
      }

            // ==========================================
      // DVA PAYMENT
      // ==========================================
      //
      // A payment made into a dedicated virtual
      // account arrives as charge.success.
      //
      // It does NOT necessarily use REPAY-LN-
      // as its reference.
      //
      // We inspect it separately before looking
      // for a normal Order.
      // ==========================================

      const isDvaPayment =
        payment.authorization?.channel ===
        "dedicated_nuban";

      if (isDvaPayment) {
        console.log(
          "🏦 DVA CHARGE SUCCESS DETECTED:",
          reference,
        );

        console.log(
          "🏦 DVA CHARGE SUCCESS FULL DATA:",
          JSON.stringify(payment, null, 2),
        );

        console.log(
          "🏦 DVA AUTHORIZATION:",
          payment.authorization || null,
        );

        console.log(
          "🏦 DVA CUSTOMER:",
          payment.customer || null,
        );

        console.log(
          "🏦 DVA METADATA:",
          payment.metadata || null,
        );

        console.log(
          "🏦 DVA AMOUNT:",
          Number(payment.amount) / 100,
        );

        console.log(
          "🏦 DVA REFERENCE:",
          payment.reference,
        );

        // ------------------------------------------
        // TEMPORARY STOP
        // ------------------------------------------
        //
        // Do not process as an Order yet.
        // We first need to identify how this DVA
        // payment is linked to the loan/user.
        // ------------------------------------------

        return res.sendStatus(200);
      }

      // ==========================================
      // NORMAL PRODUCT PAYMENT
      // ==========================================

      console.log(
        "🛒 PROCESSING NORMAL PRODUCT PAYMENT:",
        reference,
      );

      const order =
        await Order.findOne({
          paymentReference:
            reference,
        });

      if (!order) {
        console.log(
          "⚠️ ORDER NOT FOUND:",
          reference,
        );

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // IDEMPOTENCY
      // ------------------------------------------

      if (
        order.paymentStatus ===
        "paid"
      ) {
        console.log(
          "ℹ️ PAYMENT ALREADY PROCESSED:",
          reference,
        );

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // VERIFY REFERENCE
      // ------------------------------------------

      if (
        payment.reference !==
        order.paymentReference
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT REFERENCE MISMATCH",
        );

        console.error({
          expected:
            order.paymentReference,

          received:
            payment.reference,
        });

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // VERIFY AMOUNT
      // ------------------------------------------

      const expectedAmount =
        Math.round(
          Number(order.total) *
            100,
        );

      if (
        Number(payment.amount) !==
        expectedAmount
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT AMOUNT MISMATCH",
        );

        console.error({
          expected:
            expectedAmount,

          received:
            payment.amount,

          reference,
        });

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // VERIFY CURRENCY
      // ------------------------------------------

      if (
        payment.currency &&
        payment.currency !==
          "NGN"
      ) {
        console.error(
          "❌ WEBHOOK PAYMENT CURRENCY MISMATCH",
        );

        console.error({
          expected:
            "NGN",

          received:
            payment.currency,

          reference,
        });

        return res.sendStatus(200);
      }

      // ------------------------------------------
      // UPDATE ORDER
      // ------------------------------------------

      order.paymentStatus =
        "paid";

      order.paymentMethod =
        "online";

      order.paymentProvider =
        "paystack";

      order.paymentReference =
        payment.reference;

      order.paidAmount =
        Number(payment.amount) /
        100;

      order.paidAt =
        new Date();

      order.status =
        "confirmed";

      await order.save();

      // ------------------------------------------
      // ADMIN NOTIFICATION
      // ------------------------------------------

      await sendAdminPaymentNotificationOnce(
        order,
      );

      console.log(
        `✅ ORDER ${order._id} PAYMENT CONFIRMED`,
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
        error.message,
    );

    return res.sendStatus(500);
  }
};

// ==========================================
// NOTIFY ADMINS ABOUT PAID ORDER
// ==========================================

const notifyAdminsAboutPaidOrder =
  async (order) => {
    try {
      const admins =
        await User.find({
          isAdmin: true,
        }).select("_id");

      if (!admins.length) {
        console.log(
          "⚠️ NO ADMIN USERS FOUND FOR PAYMENT NOTIFICATION",
        );

        return;
      }

      const productNames =
        order.items
          .map((item) => item.name)
          .join(", ");

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
              `Total: ₦${Number(
                order.total,
              ).toLocaleString()}`,
          }),
        ),
      );

      console.log(
        `🔔 ADMIN NOTIFICATIONS SENT: ${admins.length}`,
      );
    } catch (error) {
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

  forwardLoanDvaWebhook,

  forwardKycVerificationWebhook,

  forwardLoanRepaymentWebhook,

  updatePaymentSettings,

  initializePaystackPayment,

  verifyPaystackPayment,

  paystackWebhook,

  notifyAdminsAboutPaidOrder,

  sendAdminPaymentNotificationOnce,
};
