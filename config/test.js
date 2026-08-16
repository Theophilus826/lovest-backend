const mongoose = require("mongoose");
const Order = require("../model/Order");
const Product = require("../model/Product");
const { notifyOrder } = require("../config/NotificationService");

const formatAdminOrder = (order) => {
  if (!order) return null;

  return {
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

      originalPrice: Number(
        item.originalPrice || 0,
      ),

      price: Number(item.price || 0),

      quantity: Number(
        item.quantity || 0,
      ),

      total: Number(
        item.total ??
          Number(item.price || 0) *
            Number(item.quantity || 0),
      ),
    })),

    subtotal: Number(
      order.subtotal || 0,
    ),

    deliveryFee: Number(
      order.deliveryFee || 0,
    ),

    total: Number(
      order.total || 0,
    ),

    status:
      order.status || "pending",

    paymentStatus:
      order.paymentStatus || "pending",

    paymentMethod:
      order.paymentMethod || "unknown",

    createdAt: order.createdAt,
  };
};


// ==========================================
// CREATE ORDER
// ==========================================

const createOrder = async (req, res) => {
  try {
    const {
      customer,
      deliveryAddress,
      items,
      paymentMethod = "cash_on_delivery",
    } = req.body;

    // ==========================================
    // AUTHENTICATED USER
    // ==========================================

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to place an order",
      });
    }

    const userId = req.user._id;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!customer?.name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!customer?.phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer phone is required",
      });
    }

    if (!deliveryAddress?.address?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    if (!deliveryAddress?.city?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery city is required",
      });
    }

    if (!deliveryAddress?.state?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery state is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty",
      });
    }

    // ==========================================
    // VALIDATE PAYMENT METHOD
    // ==========================================

    const allowedPaymentMethods = [
      "cash_on_delivery",
      "bank_transfer",
      "online",
    ];

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // ==========================================
    // BUILD ORDER ITEMS
    // ==========================================

    const orderItems = [];

    let subtotal = 0;

    for (const item of items) {
      if (!item.product || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: "Invalid cart item",
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product quantity",
        });
      }

      // ==========================================
      // GET PRODUCT FROM DATABASE
      // ==========================================

      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One of the products no longer exists",
        });
      }

      // ==========================================
      // CHECK PRODUCT STATUS
      // ==========================================

      if (!product.active) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is no longer available`,
        });
      }

      // ==========================================
      // CHECK STOCK
      // ==========================================

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.name} only has ${product.stock} item(s) available`,
        });
      }

      // ==========================================
      // USE DATABASE PRICE
      // ==========================================

      const price = Number(product.price);

      const itemTotal = price * quantity;

      subtotal += itemTotal;

      // ==========================================
      // SAVE PRODUCT SNAPSHOT
      // ==========================================

      orderItems.push({
        product: product._id,

        name: product.name,

        image: product.image || "",

        originalPrice: Number(product.originalPrice || 0),

        price,

        quantity,

        total: itemTotal,
      });
    }

    // ==========================================
    // DELIVERY FEE
    // ==========================================

    const deliveryFee = 1500;

    const total = subtotal + deliveryFee;

    // ==========================================
    // CREATE ORDER
    // ==========================================

    const order = await Order.create({
      // IMPORTANT:
      // Connect order to logged-in customer
      user: userId,

      customer: {
        name: customer.name.trim(),

        phone: customer.phone.trim(),

        email: customer.email
          ? customer.email.trim().toLowerCase()
          : "",
      },

      deliveryAddress: {
        address: deliveryAddress.address.trim(),

        city: deliveryAddress.city.trim(),

        state: deliveryAddress.state.trim(),
      },

      items: orderItems,

      subtotal,

      deliveryFee,

      total,

      status: "pending",

      paymentStatus: "pending",

      paymentMethod,
    });

    // ==========================================
    // REDUCE STOCK
    // ==========================================

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: {
            stock: -item.quantity,
          },
        }
      );
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    const populatedOrder = await Order.findById(
      order._id
    )
      .populate("items.product")
      .populate("user", "name email");

    try {
      await notifyOrder({
        user: userId,
        orderId: order._id,
        sender: req.user,
        message: "Your order has been placed successfully.",
      });
    } catch (notifyError) {
      console.error("Order notification failed:", notifyError);
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// ==========================================
// GET CUSTOMER ORDERS
// ==========================================

const getMyOrders = async (req, res) => {
  try {
    // ==========================================
    // AUTHENTICATION
    // ==========================================

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // ==========================================
    // ONLY GET THIS USER'S ORDERS
    // ==========================================

    const orders = await Order.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate("items.product");

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your orders",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE CUSTOMER ORDER
// ==========================================

const getOrder = async (req, res) => {
  try {
    // ==========================================
    // AUTHENTICATION
    // ==========================================

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in",
      });
    }

    // ==========================================
    // ONLY ALLOW OWNER TO VIEW ORDER
    // ==========================================

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("items.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// =========================================================
// CUSTOMER SUBMITS PAYMENT
// =========================================================

const submitPayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Customer can only submit payment for their own order
    if (
      order.user &&
      order.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this order",
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been confirmed",
      });
    }

    /*
     * Keep payment pending until an admin verifies it.
     */
    order.paymentStatus = "pending";

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment submitted successfully. Awaiting confirmation.",
      data: order,
    });
  } catch (error) {
    console.error("SUBMIT PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit payment",
    });
  }
};

// =========================================================
// ADMIN CONFIRMS PAYMENT
// =========================================================

const confirmPayment = async (req, res) => {
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

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // CHECK PAYMENT
    // ==========================================

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been confirmed",
      });
    }

    // ==========================================
    // CHECK CANCELLED ORDER
    // ==========================================

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    // ==========================================
    // CONFIRM PAYMENT
    // ==========================================

    order.paymentStatus = "paid";

    // Payment confirmation always moves
    // the order into processing.
    order.status = "processing";

    await order.save();

    // ==========================================
    // CUSTOMER NOTIFICATION
    // ==========================================

    try {
      if (order.user) {
        const shortOrderId = order._id
          .toString()
          .slice(-8)
          .toUpperCase();

        await notify({
          user: order.user,
          sender: req.user,
          type: "order",
          orderId: order._id,
          message: `✅ Payment confirmed for order #${shortOrderId}. Your order is now being processed.`,
        });
      }
    } catch (notificationError) {
      console.error(
        "PAYMENT NOTIFICATION ERROR:",
        notificationError.message,
      );
    }

    // ==========================================
    // GET UPDATED ORDER
    // ==========================================

    const updatedOrder = await Order.findById(order._id)
      .populate("user", "name email phone")
      .populate("items.product", "name image");

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "Payment confirmed and order moved to processing",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("CONFIRM PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
    });
  }
};

// =========================================================
// UPDATE ORDER STATUS - ADMIN
// =========================================================

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // =======================================================
    // VALIDATE ORDER ID
    // =======================================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // =======================================================
    // VALIDATE STATUS
    // =======================================================

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    // =======================================================
    // FIND ORDER
    // =======================================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // =======================================================
    // DON'T UPDATE IF SAME STATUS
    // =======================================================

    if (order.status === status) {
      return res.status(400).json({
        success: false,
        message: `Order is already ${status}`,
      });
    }

    // =======================================================
    // PREVENT CHANGES TO CANCELLED ORDERS
    // =======================================================

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be updated",
      });
    }

    const previousStatus = order.status;

    // =======================================================
    // UPDATE STATUS
    // =======================================================

    order.status = status;

    await order.save();

    // =======================================================
    // CUSTOMER NOTIFICATION
    // =======================================================

    if (order.user) {
      try {
        const statusMessages = {
          pending: `📦 Your order #${order._id} is pending.`,
          confirmed: `✅ Your order #${order._id} has been confirmed.`,
          processing: `⚙️ Your order #${order._id} is now being processed.`,
          shipped: `🚚 Your order #${order._id} has been shipped.`,
          delivered: `🎉 Your order #${order._id} has been delivered.`,
          cancelled: `❌ Your order #${order._id} has been cancelled.`,
        };

        await notifyOrder({
          user: order.user,
          orderId: order._id,
          message:
            statusMessages[status] ||
            `Your order #${order._id} status has been updated to ${status}.`,
        });
      } catch (notificationError) {
        console.error(
          "ORDER STATUS NOTIFICATION ERROR:",
          notificationError.message,
        );
      }
    }

    // =======================================================
    // RESPONSE
    // =======================================================

    const populatedOrder = await Order.findById(
      order._id,
    ).populate("items.product");

    return res.status(200).json({
      success: true,
      message: `Order status updated from ${previousStatus} to ${status}`,
      data: populatedOrder,
    });
  } catch (error) {
    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  submitPayment,
  confirmPayment,
  updateOrderStatus,
};
