const Payment = require("../model/PaymentSettings");

// ==========================================
// GET PAYMENT SETTINGS
// ==========================================

const getPaymentSettings = async (req, res) => {
  try {
    let payment = await Payment.findOne();

    // Create default settings if none exist
    if (!payment) {
      payment = await Payment.create({
        bankName: "",
        accountName: "",
        accountNumber: "",
        paymentLink: "",
      });
    }

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error(
      "GET PAYMENT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load payment settings",
    });
  }
};

// ==========================================
// UPDATE PAYMENT SETTINGS
// ==========================================

const updatePaymentSettings = async (req, res) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
      paymentLink,
    } = req.body;

    if (!bankName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bank name is required",
      });
    }

    if (!accountName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account name is required",
      });
    }

    if (!accountNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account number is required",
      });
    }

    let payment = await Payment.findOne();

    if (!payment) {
      payment = new Payment();
    }

    payment.bankName = bankName.trim();
    payment.accountName = accountName.trim();
    payment.accountNumber = accountNumber.trim();
    payment.paymentLink = paymentLink?.trim() || "";

    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment settings saved successfully",
      data: payment,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYMENT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save payment settings",
    });
  }
};



module.exports = {
  getPaymentSettings,
  updatePaymentSettings,

};