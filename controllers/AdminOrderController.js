const mongoose = require("mongoose");
const Order = require("../model/Order");
const { notifyOrder } = require("../config/NotificationService");

// ==========================================
// ADMIN - GET ALL ORDERS
// ==========================================

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("Get all orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - GET SINGLE ORDER
// ==========================================

const getAdminOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ORDER ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // ==========================================
    // FIND ORDER
    // ==========================================

    const order = await Order.findById(id)
      .populate("user", "name phone email")
      .populate("items.product", "name image");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // FORMAT ORDER FOR ADMIN FRONTEND
    // ==========================================

    const formattedOrder = {
      _id: order._id,

      customer: {
        name: order.user?.name || "Unknown Customer",
        phone: order.user?.phone || "No phone",
        email: order.user?.email || "",
      },

      deliveryAddress: {
        address: order.deliveryAddress?.address || "",
        city: order.deliveryAddress?.city || "",
        state: order.deliveryAddress?.state || "",
      },

      items: (order.items || []).map((item) => ({
        product: item.product
          ? {
              _id: item.product._id,
              name: item.product.name,
              image: item.product.image,
            }
          : undefined,

        name:
          item.name ||
          item.product?.name ||
          "Product",

        image:
          item.image ||
          item.product?.image ||
          "",

        originalPrice:
          Number(item.originalPrice || 0),

        price:
          Number(item.price || 0),

        quantity:
          Number(item.quantity || 0),

        total:
          Number(
            item.total ??
              Number(item.price || 0) *
                Number(item.quantity || 0),
          ),
      })),

      subtotal:
        Number(order.subtotal || 0),

      deliveryFee:
        Number(order.deliveryFee || 0),

      total:
        Number(order.total || 0),

      status:
        order.status || "pending",

      paymentStatus:
        order.paymentStatus || "pending",

      paymentMethod:
        order.paymentMethod || "unknown",

      createdAt:
        order.createdAt,
    };

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error(
      "GET ADMIN ORDER ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
};

// ==========================================
// ADMIN - UPDATE ORDER / SHIPPING STATUS
// ==========================================

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      status,
      shippingStatus,
      carrier,
      trackingNumber,
    } = req.body;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // ==========================================
    // VALIDATE ORDER STATUS
    // ==========================================

    const allowedOrderStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    // ==========================================
    // VALIDATE SHIPPING STATUS
    // ==========================================

    const allowedShippingStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (
      status !== undefined &&
      !allowedOrderStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    if (
      shippingStatus !== undefined &&
      !allowedShippingStatuses.includes(
        shippingStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping status",
      });
    }

    // ==========================================
    // FIND ORDER
    // ==========================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // UPDATE ORDER STATUS
    // ==========================================

    if (status !== undefined) {
      order.status = status;
    }

    // ==========================================
    // UPDATE SHIPPING STATUS
    // ==========================================

    if (shippingStatus !== undefined) {
      order.shippingStatus = shippingStatus;
    }

    // ==========================================
    // UPDATE CARRIER
    // ==========================================

    if (carrier !== undefined) {
      order.shipping = order.shipping || {};
      order.shipping.courier = carrier.trim();
    }

    // ==========================================
    // UPDATE TRACKING NUMBER
    // ==========================================

    if (trackingNumber !== undefined) {
      order.shipping = order.shipping || {};
      order.shipping.trackingNumber =
        trackingNumber.trim();
    }

    await order.save();

    // ==========================================
    // NOTIFY CUSTOMER
    // ==========================================

    try {
      if (order.user) {
        let message;

        if (shippingStatus !== undefined) {
          const shippingMessages = {
            pending:
              "⏳ Your shipment is pending.",
            processing:
              "📦 Your shipment is being processed.",
            shipped:
              "🚚 Your shipment has been shipped.",
            delivered:
              "🎉 Your shipment has been delivered.",
            cancelled:
              "❌ Your shipment has been cancelled.",
          };

          message =
            shippingMessages[shippingStatus] ||
            `Your shipping status is now ${shippingStatus}.`;
        } else if (status !== undefined) {
          const orderMessages = {
            pending:
              "⏳ Your order is pending.",
            confirmed:
              "✅ Your order has been confirmed.",
            processing:
              "📦 Your order is being processed.",
            shipped:
              "🚚 Your order has been shipped.",
            delivered:
              "🎉 Your order has been delivered.",
            cancelled:
              "❌ Your order has been cancelled.",
          };

          message =
            orderMessages[status] ||
            `Your order status is now ${status}.`;
        }

        if (message) {
          await notifyOrder({
            user: order.user,
            orderId: order._id,
            sender: req.user,
            message,
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "ORDER STATUS NOTIFICATION ERROR:",
        notificationError.message
      );
    }

    // ==========================================
    // RETURN UPDATED ORDER
    // ==========================================

    const updatedOrder =
      await Order.findById(order._id)
        .populate(
          "user",
          "name phone email"
        )
        .populate(
          "items.product",
          "name image"
        );

    const formattedOrder = {
      _id: updatedOrder._id,

      customer: {
        name:
          updatedOrder.user?.name ||
          "Unknown Customer",

        phone:
          updatedOrder.user?.phone ||
          "No phone",

        email:
          updatedOrder.user?.email ||
          "",
      },

      deliveryAddress: {
        address:
          updatedOrder.deliveryAddress
            ?.address || "",

        city:
          updatedOrder.deliveryAddress
            ?.city || "",

        state:
          updatedOrder.deliveryAddress
            ?.state || "",
      },

      items: (
        updatedOrder.items || []
      ).map((item) => ({
        product: item.product
          ? {
              _id: item.product._id,
              name: item.product.name,
              image: item.product.image,
            }
          : undefined,

        name:
          item.name ||
          item.product?.name ||
          "Product",

        image:
          item.image ||
          item.product?.image ||
          "",

        originalPrice:
          Number(
            item.originalPrice || 0
          ),

        price:
          Number(item.price || 0),

        quantity:
          Number(item.quantity || 0),

        total: Number(
          item.total ??
            Number(item.price || 0) *
              Number(item.quantity || 0)
        ),
      })),

      subtotal:
        Number(
          updatedOrder.subtotal || 0
        ),

      deliveryFee:
        Number(
          updatedOrder.deliveryFee || 0
        ),

      total:
        Number(updatedOrder.total || 0),

      // ORDER STATUS
      status:
        updatedOrder.status ||
        "pending",

      // SHIPPING STATUS
      shippingStatus:
        updatedOrder.shippingStatus ||
        "pending",

      // SHIPPING DETAILS
      carrier:
        updatedOrder.shipping?.courier || "",

      trackingNumber:
        updatedOrder.shipping?.trackingNumber ||
        "",

      paymentStatus:
        updatedOrder.paymentStatus ||
        "pending",

      paymentMethod:
        updatedOrder.paymentMethod ||
        "unknown",

      createdAt:
        updatedOrder.createdAt,

      updatedAt:
        updatedOrder.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message:
        "Order shipping information updated successfully",
      data: formattedOrder,
    });
  } catch (error) {
    console.error(
      "UPDATE ORDER / SHIPPING STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update order shipping information",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - UPDATE PAYMENT STATUS
// ==========================================

const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const allowedStatuses = [
      "pending",
      "paid",
      "failed",
      "refunded",
    ];

    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.paymentStatus = paymentStatus;

    await order.save();

    try {
      await notifyOrder({
        user: order.user,
        orderId: order._id,
        sender: req.user,
        message: `Your payment status is now ${paymentStatus}.`,
      });
    } catch (notifyError) {
      console.error("Order payment notification failed:", notifyError);
    }

    const updatedOrder = await Order.findById(order._id)
      .populate("items.product");

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error(
      "Update payment status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN GET PAYMENTS
// ==========================================

const getAdminPayments = async (req, res) => {
  try {
    const orders = await Order.find({
      paymentStatus: {
        $in: ["pending", "paid"],
      },
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error(
      "GET ADMIN PAYMENTS ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

module.exports = {
  getAllOrders,
  getAdminOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getAdminPayments,
};