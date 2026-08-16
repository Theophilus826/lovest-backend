
const express = require("express");

const {
  getAllOrders,
  getAdminOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getAdminPayments,
} = require("../controllers/AdminOrderController");

const {
  confirmPayment,
  shipOrder,
  deliverOrder,
} = require("../controllers/OrderController");

const {
  protect,
  admin,
} = require("../middleware/AuthMiddleware");

const router = express.Router();

// =========================================================
// ADMIN ORDERS
// =========================================================

// GET /api/admin/orders
router.get(
  "/",
  protect,
  admin,
  getAllOrders
);

// GET /api/admin/orders/:id
router.get(
  "/:id",
  protect,
  admin,
  getAdminOrder
);

// =========================================================
// ORDER STATUS
// =========================================================

// PATCH /api/admin/orders/:id/status
//
// Used for:
// pending
// confirmed
// processing
// cancelled

router.patch(
  "/:id/status",
  protect,
  admin,
  updateOrderStatus
);

// =========================================================
// PAYMENT
// =========================================================

// PATCH /api/admin/orders/:id/payment
router.patch(
  "/:id/payment",
  protect,
  admin,
  updatePaymentStatus
);

// PATCH /api/admin/orders/:id/confirm-payment
router.patch(
  "/:id/confirm-payment",
  protect,
  admin,
  confirmPayment
);

// =========================================================
// PAYMENTS
// =========================================================

// GET /api/admin/orders/payments
router.get(
  "/payments",
  protect,
  admin,
  getAdminPayments
);

// =========================================================
// SHIPPING
// =========================================================

// PATCH /api/admin/orders/:id/ship
//
// processing → shipped

router.patch(
  "/:id/ship",
  protect,
  admin,
  shipOrder
);

// =========================================================
// DELIVERY
// =========================================================

// PATCH /api/admin/orders/:id/deliver
//
// shipped → delivered

router.patch(
  "/:id/deliver",
  protect,
  admin,
  deliverOrder
);

module.exports = router;

