const express = require("express");

const router = express.Router();

const {
  createOrder,
  getMyOrders,
  getOrder,
  submitPayment,
  confirmOrderReceipt,

  // Admin
  getAllOrders,
  getAdminOrder,
  confirmPayment,
  updatePaymentStatus,
  getAdminPayments,
  updateOrderStatus,
  shipOrder,
  deliverOrder,
} = require("../controllers/OrderController");

const {
  protect,
  admin,
} = require("../middleware/authMiddleware");

// =========================================================
// CUSTOMER ORDERS
// =========================================================

// Create order
router.post(
  "/",
  protect,
  createOrder
);

// Get logged-in customer's orders
router.get(
  "/my-orders",
  protect,
  getMyOrders
);

// Get single customer's order
router.get(
  "/:id",
  protect,
  getOrder
);

// Customer submits payment
router.patch(
  "/:id/payment",
  protect,
  submitPayment
);

// =========================================================
// ADMIN ORDERS
// =========================================================

// Get all orders
router.get(
  "/admin/all",
  protect,
  admin,
  getAllOrders
);

// Get single admin order
router.get(
  "/admin/:id",
  protect,
  admin,
  getAdminOrder
);

// =========================================================
// ADMIN PAYMENTS
// =========================================================

// Get all payments
router.get(
  "/admin/payments",
  protect,
  admin,
  getAdminPayments
);

// Confirm payment
router.patch(
  "/admin/:id/confirm-payment",
  protect,
  admin,
  confirmPayment
);

// Update payment status
router.patch(
  "/admin/:id/payment-status",
  protect,
  admin,
  updatePaymentStatus
);

// =========================================================
// ADMIN ORDER STATUS
// =========================================================
//
// Allowed manual statuses:
//
// pending
// confirmed
// processing
// cancelled
//
// Shipping statuses are handled separately below.
//
// =========================================================

router.patch(
  "/admin/:id/status",
  protect,
  admin,
  updateOrderStatus
);

// =========================================================
// ADMIN SHIPPING
// =========================================================

// Processing → Shipped
router.patch(
  "/admin/:id/ship",
  protect,
  admin,
  shipOrder
);

// Shipped → Delivered
router.patch(
  "/admin/:id/deliver",
  protect,
  admin,
  deliverOrder
);

router.patch(
  "/:id/confirm-received",
  protect,
  confirmOrderReceipt
);

router.patch(
  "/:id/confirm-receipt",
  protect,
  confirmOrderReceipt
);
// =========================================================
// EXPORT
// =========================================================

module.exports = router;