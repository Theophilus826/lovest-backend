
const mongoose = require("mongoose");
const Order = require("../model/Order");
const Product = require("../model/Product");
const {
  notifyOrder,
} = require("../config/NotificationService");

// =========================================================
// FORMAT ORDER FOR ADMIN
// =========================================================

const formatAdminOrder = (order) => {
  if (!order) return null;

  // =========================================================
  // CUSTOMER
  // =========================================================

  const customer = {
    name:
      order.user?.name ||
      order.customer?.name ||
      "Unknown Customer",

    phone:
      order.user?.phone ||
      order.customer?.phone ||
      "No phone",

    email:
      order.user?.email ||
      order.customer?.email ||
      "",
  };

  // =========================================================
  // DELIVERY ADDRESS
  // =========================================================

  const deliveryAddress = {
    name:
      order.deliveryAddress?.name ||
      order.customer?.name ||
      order.user?.name ||
      "",

    address:
      order.deliveryAddress?.address ||
      "",

    city:
      order.deliveryAddress?.city ||
      "",

    state:
      order.deliveryAddress?.state ||
      "",

    country:
      order.deliveryAddress?.country ||
      "",

    postalCode:
      order.deliveryAddress?.postalCode ||
      "",

    phone:
      order.deliveryAddress?.phone ||
      order.customer?.phone ||
      order.user?.phone ||
      "",
  };

  // =========================================================
  // SHIPPING STATUS
  //
  // IMPORTANT:
  // shippingStatus is independent from order.status.
  // =========================================================

  const shippingStatus =
    order.shippingStatus ||
    "pending";

  // =========================================================
  // SHIPPING INFORMATION
  // =========================================================

  const carrier =
    order.shipping?.courier ||
    order.shippingCarrier ||
    order.carrier ||
    "";

  const trackingNumber =
    order.shipping?.trackingNumber ||
    order.trackingNumber ||
    order.tracking ||
    "";

  // =========================================================
  // SHIPPING DATES
  // =========================================================

  const shippedAt =
    order.shipping?.shippedAt ||
    null;

  const estimatedDeliveryDate =
    order.shipping?.estimatedDeliveryDate ||
    null;

  const deliveredAt =
    order.shipping?.deliveredAt ||
    null;

  const shippingNotes =
    order.shipping?.notes ||
    "";

  // =========================================================
  // CUSTOMER RECEIPT CONFIRMATION
  //
  // This is separate from shippingStatus.
  //
  // Example:
  // shippingStatus = "delivered"
  // customerConfirmed = true
  //
  // This allows the admin to know that the customer
  // actually confirmed receiving the product.
  // =========================================================

  const customerConfirmed =
    order.customerConfirmed === true ||
    order.receiptConfirmed === true ||
    order.deliveryConfirmed === true;

  const customerConfirmedAt =
    order.customerConfirmedAt ||
    order.receiptConfirmedAt ||
    order.deliveryConfirmedAt ||
    null;

  // =========================================================
  // ITEMS
  // =========================================================

  const items = Array.isArray(order.items)
    ? order.items.map((item) => {
        const price = Number(item.price || 0);

        const quantity = Number(
          item.quantity || 0
        );

        const total =
          item.total !== undefined &&
          item.total !== null
            ? Number(item.total)
            : price * quantity;

        return {
          product: item.product
            ? {
                _id: item.product._id,

                name:
                  item.product.name ||
                  item.name ||
                  "Product",

                image:
                  item.product.image ||
                  item.image ||
                  "",
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

          price,

          quantity,

          total,
        };
      })
    : [];

  // =========================================================
  // RETURN ADMIN ORDER
  // =========================================================

  return {
    // =======================================================
    // BASIC
    // =======================================================

    _id: order._id,

    // =======================================================
    // CUSTOMER
    // =======================================================

    customer,

    // Keep user for compatibility
    user: order.user
      ? {
          _id: order.user._id,
          name: order.user.name,
          phone: order.user.phone,
          email: order.user.email,
        }
      : undefined,

    // =======================================================
    // DELIVERY ADDRESS
    // =======================================================

    deliveryAddress,

    // Compatibility
    shippingAddress: deliveryAddress,

    // =======================================================
    // ITEMS
    // =======================================================

    items,

    // =======================================================
    // PRICING
    // =======================================================

    subtotal:
      Number(order.subtotal || 0),

    deliveryFee:
      Number(order.deliveryFee || 0),

    total:
      Number(order.total || 0),

    // =======================================================
    // ORDER STATUS
    // =======================================================

    status:
      order.status ||
      "pending",

    // =======================================================
    // PAYMENT
    // =======================================================

    paymentStatus:
      order.paymentStatus ||
      "pending",

    paymentMethod:
      order.paymentMethod ||
      "unknown",

    // =======================================================
    // SHIPPING STATUS
    // =======================================================

    shippingStatus,

    // =======================================================
    // SHIPPING SHORTCUTS
    // =======================================================

    carrier,

    shippingCarrier:
      carrier,

    trackingNumber,

    tracking:
      trackingNumber,

    // =======================================================
    // FULL SHIPPING OBJECT
    // =======================================================

    shipping: {
      courier: carrier,

      trackingNumber,

      shippedAt,

      estimatedDeliveryDate,

      deliveredAt,

      notes: shippingNotes,
    },

    // =======================================================
    // CUSTOMER RECEIPT CONFIRMATION
    // =======================================================

    customerConfirmed,

    customerConfirmedAt,

    // Compatibility aliases
    receiptConfirmed:
      customerConfirmed,

    receiptConfirmedAt:
      customerConfirmedAt,

    deliveryConfirmed:
      customerConfirmed,

    deliveryConfirmedAt:
      customerConfirmedAt,

    // =======================================================
    // DATES
    // =======================================================

    createdAt:
      order.createdAt,

    updatedAt:
      order.updatedAt,
  };
};

// =========================================================
// CREATE ORDER
// =========================================================

const createOrder = async (req, res) => {
  try {
    const {
      customer,
      deliveryAddress,
      items,
      paymentMethod = "cash_on_delivery",
    } = req.body;

    // ==========================================
    // AUTHENTICATION
    // ==========================================

    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "You must be logged in to place an order",
      });
    }

    const userId = req.user._id;

    // ==========================================
    // VALIDATE CUSTOMER
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

    // ==========================================
    // VALIDATE DELIVERY ADDRESS
    // ==========================================

    if (!deliveryAddress?.address?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery address is required",
      });
    }

    if (!deliveryAddress?.city?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery city is required",
      });
    }

    if (!deliveryAddress?.state?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery state is required",
      });
    }

    // ==========================================
    // VALIDATE CART
    // ==========================================

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
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

    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment method",
      });
    }

    // ==========================================
    // BUILD ORDER ITEMS
    // ==========================================

    const orderItems = [];

    let subtotal = 0;

    for (const item of items) {
      if (
        !item.product ||
        !item.quantity
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid cart item",
        });
      }

      const quantity = Number(
        item.quantity
      );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product quantity",
        });
      }

      // ========================================
      // GET PRODUCT
      // ========================================

      const product =
        await Product.findById(
          item.product
        );

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "One of the products no longer exists",
        });
      }

      // ========================================
      // CHECK PRODUCT STATUS
      // ========================================

      if (!product.active) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} is no longer available`,
        });
      }

      // ========================================
      // CHECK STOCK
      // ========================================

      if (
        product.stock < quantity
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${product.name} only has ${product.stock} item(s) available`,
        });
      }

      // ========================================
      // USE DATABASE PRICE
      // ========================================

      const price = Number(
        product.price
      );

      const itemTotal =
        price * quantity;

      subtotal += itemTotal;

      // ========================================
      // PRODUCT SNAPSHOT
      // ========================================

      orderItems.push({
        product: product._id,

        name: product.name,

        image:
          product.image || "",

        originalPrice:
          Number(
            product.originalPrice || 0
          ),

        price,

        quantity,

        total: itemTotal,
      });
    }

    // ==========================================
    // DELIVERY FEE
    // ==========================================

    const deliveryFee = 1500;

    const total =
      subtotal + deliveryFee;

    // ==========================================
    // CREATE ORDER
    // ==========================================

    const order = await Order.create({
      user: userId,

      customer: {
        name:
          customer.name.trim(),

        phone:
          customer.phone.trim(),

        email: customer.email
          ? customer.email
              .trim()
              .toLowerCase()
          : "",
      },

      deliveryAddress: {
        address:
          deliveryAddress.address.trim(),

        city:
          deliveryAddress.city.trim(),

        state:
          deliveryAddress.state.trim(),
      },

      items: orderItems,

      subtotal,

      deliveryFee,

      total,

      status: "pending",

      paymentStatus: "pending",

      paymentMethod,

      // Shipping starts empty.
      shipping: {
        courier: "",
        trackingNumber: "",
        shippedAt: null,
        estimatedDeliveryDate: null,
        deliveredAt: null,
        notes: "",
      },
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
    // POPULATE ORDER
    // ==========================================

    const populatedOrder =
      await Order.findById(
        order._id
      )
        .populate("items.product")
        .populate(
          "user",
          "name email phone"
        );

    // ==========================================
    // NOTIFICATION
    // ==========================================

    try {
      await notifyOrder({
        user: userId,

        orderId: order._id,

        sender: req.user,

        message:
          "Your order has been placed successfully.",
      });
    } catch (notifyError) {
      console.error(
        "ORDER NOTIFICATION ERROR:",
        notifyError.message
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create order",
      error: error.message,
    });
  }
};

// =========================================================
// GET ALL ORDERS - ADMIN
// =========================================================

const getAllOrders = async (
  req,
  res
) => {
  try {
    const orders =
      await Order.find()
        .populate(
          "user",
          "name phone email"
        )
        .populate(
          "items.product",
          "name image"
        )
        .sort({
          createdAt: -1,
        });

    const formattedOrders =
      orders.map(
        formatAdminOrder
      );

    return res.status(200).json({
      success: true,
      count:
        formattedOrders.length,
      data: formattedOrders,
    });
  } catch (error) {
    console.error(
      "GET ALL ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch orders",
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
      .populate(
        "user",
        "name phone email"
      )
      .populate(
        "items.product",
        "name image"
      );

    // ==========================================
    // ORDER NOT FOUND
    // ==========================================

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ==========================================
    // RETURN ADMIN ORDER
    // ==========================================

    return res.status(200).json({
      success: true,
      data: formatAdminOrder(order),
    });
  } catch (error) {
    console.error(
      "GET ADMIN ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// =========================================================
// GET CUSTOMER ORDERS
// =========================================================

const getMyOrders = async (
  req,
  res
) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "You must be logged in",
      });
    }

    const orders =
      await Order.find({
        user: req.user._id,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "items.product"
        );

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error(
      "GET MY ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch your orders",
      error: error.message,
    });
  }
};

// =========================================================
// GET SINGLE CUSTOMER ORDER
// =========================================================

const getOrder = async (
  req,
  res
) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message:
          "You must be logged in",
      });
    }

    const order =
      await Order.findOne({
        _id: req.params.id,
        user: req.user._id,
      }).populate(
        "items.product"
      );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error(
      "GET ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch order",
      error: error.message,
    });
  }
};

// =========================================================
// CUSTOMER SUBMITS PAYMENT
// =========================================================

const submitPayment = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order ID",
      });
    }

    const order =
      await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found",
      });
    }

    // ========================================
    // OWNER CHECK
    // ========================================

    if (
      order.user &&
      order.user.toString() !==
        req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to update this order",
      });
    }

    // ========================================
    // CANCELLED CHECK
    // ========================================

    if (
      order.status ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled orders cannot be paid",
      });
    }

    // ========================================
    // ALREADY PAID
    // ========================================

    if (
      order.paymentStatus ===
      "paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment has already been confirmed",
      });
    }

    // ========================================
    // KEEP PAYMENT PENDING
    // ========================================

    order.paymentStatus =
      "pending";

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment submitted successfully. Awaiting confirmation.",
      data: order,
    });
  } catch (error) {
    console.error(
      "SUBMIT PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit payment",
    });
  }
};

// =========================================================
// ADMIN CONFIRMS PAYMENT
// =========================================================

const confirmPayment = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order ID",
      });
    }

    const order =
      await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found",
      });
    }

    if (
      order.paymentStatus ===
      "paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment has already been confirmed",
      });
    }

    if (
      order.status ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled orders cannot be paid",
      });
    }

    // ========================================
    // CONFIRM PAYMENT
    // ========================================

    order.paymentStatus =
      "paid";

    // ========================================
    // MOVE TO PROCESSING
    // ========================================

    order.status =
      "processing";

    await order.save();

    // ========================================
    // NOTIFY CUSTOMER
    // ========================================

    try {
      if (order.user) {
        const shortOrderId =
          order._id
            .toString()
            .slice(-8)
            .toUpperCase();

        await notifyOrder({
          user: order.user,

          orderId: order._id,

          sender: req.user,

          message:
            `✅ Payment confirmed for order #${shortOrderId}. Your order is now being processed.`,
        });
      }
    } catch (notifyError) {
      console.error(
        "PAYMENT NOTIFICATION ERROR:",
        notifyError.message
      );
    }

    // ========================================
    // GET UPDATED ORDER
    // ========================================

    const updatedOrder =
      await Order.findById(
        order._id
      )
        .populate(
          "user",
          "name email phone"
        )
        .populate(
          "items.product",
          "name image"
        );

    return res.status(200).json({
      success: true,
      message:
        "Payment confirmed and order moved to processing",
      data: formatAdminOrder(
        updatedOrder
      ),
    });
  } catch (error) {
    console.error(
      "CONFIRM PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to confirm payment",
    });
  }
};

// =========================================================
// ADMIN UPDATE ORDER STATUS
// =========================================================

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ========================================
    // VALIDATE ORDER ID
    // ========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // ========================================
    // ALLOWED ORDER STATUSES
    // ========================================

    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status for this endpoint",
      });
    }

    // ========================================
    // FIND ORDER
    // ========================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ========================================
    // CANCELLED ORDERS
    // ========================================

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be updated",
      });
    }

    // ========================================
    // SAME STATUS
    // ========================================

    if (order.status === status) {
      return res.status(400).json({
        success: false,
        message: `Order is already ${status}`,
      });
    }

    const previousStatus = order.status;

    // ========================================
    // STATUS RULES
    // ========================================

    if (
      status === "processing" &&
      order.paymentStatus !== "paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment must be confirmed before processing the order",
      });
    }

    // ========================================
    // UPDATE ORDER STATUS
    // ========================================

    await Order.findByIdAndUpdate(
      id,
      { status },
      {
        new: false,
      }
    );

    // ========================================
    // NOTIFICATION
    // ========================================

    try {
      if (order.user) {
        const messages = {
          pending:
            `📦 Your order #${order._id} is pending.`,

          confirmed:
            `✅ Your order #${order._id} has been confirmed.`,

          processing:
            `⚙️ Your order #${order._id} is now being processed.`,

          cancelled:
            `❌ Your order #${order._id} has been cancelled.`,
        };

        await notifyOrder({
          user: order.user,
          orderId: order._id,
          sender: req.user,
          message:
            messages[status] ||
            `Your order #${order._id} status has been updated.`,
        });
      }
    } catch (notifyError) {
      console.error(
        "STATUS NOTIFICATION ERROR:",
        notifyError.message
      );
    }

    // ========================================
    // GET UPDATED ORDER
    // ========================================

    const updatedOrder = await Order.findById(order._id)
      .populate(
        "user",
        "name phone email"
      )
      .populate(
        "items.product",
        "name image"
      );

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      message:
        `Order status updated from ${previousStatus} to ${status}`,

      data: formatAdminOrder(updatedOrder),
    });
  } catch (error) {
    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

// =========================================================
// ADMIN SHIP ORDER
// =========================================================

const shipOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      shippingStatus,
      courier,
      trackingNumber,
      estimatedDeliveryDate,
      notes,
    } = req.body;

    // ========================================
    // VALIDATE ORDER ID
    // ========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // ========================================
    // FIND ORDER
    // ========================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ========================================
    // SHIPPING STATUS
    // ========================================

    const allowedShippingStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    /*
     * IMPORTANT:
     *
     * If this endpoint is /ship and the frontend
     * doesn't explicitly provide shippingStatus,
     * default to "shipped", NOT "pending".
     */

    const newShippingStatus =
      shippingStatus || "shipped";

    if (
      !allowedShippingStatuses.includes(
        newShippingStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping status",
      });
    }

    // ========================================
    // CANCELLED ORDER CHECK
    // ========================================

    if (
      order.status === "cancelled" &&
      newShippingStatus !== "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled orders cannot have their shipping status changed",
      });
    }

    // ========================================
    // PAYMENT CHECK
    // ========================================

    if (
      ["shipped", "delivered"].includes(
        newShippingStatus,
      ) &&
      order.paymentStatus !== "paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment must be confirmed before shipping or delivering the order",
      });
    }

    // ========================================
    // SHIPPING DATA
    // ========================================

    const currentShipping =
      order.shipping || {};

    const cleanCourier =
      typeof courier === "string"
        ? courier.trim()
        : currentShipping.courier || "";

    const cleanTrackingNumber =
      typeof trackingNumber === "string"
        ? trackingNumber.trim()
        : currentShipping.trackingNumber || "";

    const cleanNotes =
      typeof notes === "string"
        ? notes.trim()
        : currentShipping.notes || "";

    // ========================================
    // REQUIRE SHIPPING INFORMATION
    // ========================================

    if (
      ["shipped", "delivered"].includes(
        newShippingStatus,
      )
    ) {
      if (!cleanCourier) {
        return res.status(400).json({
          success: false,
          message:
            "Courier is required when shipment is shipped or delivered",
        });
      }

      if (!cleanTrackingNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Tracking number is required when shipment is shipped or delivered",
        });
      }
    }

    // ========================================
    // ESTIMATED DELIVERY DATE
    // ========================================

    let estimatedDate =
      currentShipping.estimatedDeliveryDate ||
      null;

    if (estimatedDeliveryDate !== undefined) {
      if (!estimatedDeliveryDate) {
        estimatedDate = null;
      } else {
        estimatedDate = new Date(
          estimatedDeliveryDate,
        );

        if (
          Number.isNaN(
            estimatedDate.getTime(),
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid estimated delivery date",
          });
        }
      }
    }

    // ========================================
    // SHIPPING DATES
    // ========================================

    let shippedAt =
      currentShipping.shippedAt || null;

    let deliveredAt =
      currentShipping.deliveredAt || null;

    if (
      newShippingStatus === "shipped" ||
      newShippingStatus === "delivered"
    ) {
      if (!shippedAt) {
        shippedAt = new Date();
      }
    }

    if (newShippingStatus === "delivered") {
      if (!deliveredAt) {
        deliveredAt = new Date();
      }
    } else {
      deliveredAt = null;
    }

    // ========================================
    // PREVIOUS STATUS
    // ========================================

    const previousShippingStatus =
      order.shippingStatus ||
      order.status ||
      "pending";

    const previousOrderStatus =
      order.status || "pending";

    // ========================================
    // UPDATE SHIPPING STATUS
    // ========================================

    order.shippingStatus =
      newShippingStatus;

    // ========================================
    // IMPORTANT:
    // KEEP MAIN ORDER STATUS IN SYNC
    // ========================================

    if (newShippingStatus === "shipped") {
      order.status = "shipped";
    }

    if (newShippingStatus === "delivered") {
      order.status = "delivered";
    }

    if (newShippingStatus === "cancelled") {
      order.status = "cancelled";
    }

    if (newShippingStatus === "processing") {
      order.status = "processing";
    }

    if (newShippingStatus === "pending") {
      order.status = "pending";
    }

    // ========================================
    // UPDATE SHIPPING INFORMATION
    // ========================================

    order.shipping = {
      courier: cleanCourier,
      trackingNumber: cleanTrackingNumber,
      shippedAt,
      estimatedDeliveryDate: estimatedDate,
      deliveredAt,
      notes: cleanNotes,
    };

    // ========================================
    // SAVE
    // ========================================

    await order.save();

    // ========================================
    // NOTIFICATION
    // ========================================

    try {
      if (order.user) {
        const shortOrderId =
          order._id
            .toString()
            .slice(-8)
            .toUpperCase();

        const messages = {
          pending:
            `📦 Shipping for order #${shortOrderId} is pending.`,

          processing:
            `⚙️ Shipping for order #${shortOrderId} is being processed.`,

          shipped:
            `🚚 Your order #${shortOrderId} has been shipped. Tracking number: ${cleanTrackingNumber}.`,

          delivered:
            `🎉 Your order #${shortOrderId} has been delivered.`,

          cancelled:
            `❌ Shipping for order #${shortOrderId} has been cancelled.`,
        };

        await notifyOrder({
          user: order.user,
          orderId: order._id,
          sender: req.user,
          message:
            messages[newShippingStatus] ||
            `Shipping status for order #${shortOrderId} is now ${newShippingStatus}.`,
        });
      }
    } catch (notifyError) {
      console.error(
        "SHIPPING NOTIFICATION ERROR:",
        notifyError.message,
      );
    }

    // ========================================
    // GET UPDATED ORDER
    // ========================================

    const updatedOrder =
      await Order.findById(order._id)
        .populate(
          "user",
          "name phone email",
        )
        .populate(
          "items.product",
          "name image",
        );

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,

      message:
        `Order shipping status updated from ${previousShippingStatus} to ${newShippingStatus}`,

      data: formatAdminOrder(updatedOrder),
    });
  } catch (error) {
    console.error(
      "SHIP ORDER ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update shipping",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - MARK ORDER AS DELIVERED
// ==========================================

const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // ========================================
    // VALIDATE ID
    // ========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // ========================================
    // FIND ORDER
    // ========================================

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ========================================
    // CANCELLED CHECK
    // ========================================

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be delivered",
      });
    }

    // ========================================
    // STATUS CHECK
    // ========================================

    if (order.status !== "shipped") {
      return res.status(400).json({
        success: false,
        message: "Only shipped orders can be marked as delivered",
      });
    }

    // ========================================
    // UPDATE DELIVERY
    // ========================================

    order.status = "delivered";

    order.shipping = {
      ...(order.shipping?.toObject
        ? order.shipping.toObject()
        : order.shipping || {}),

      deliveredAt: new Date(),
    };

    await order.save();

    // ========================================
    // NOTIFY CUSTOMER
    // ========================================

    try {
      if (order.user) {
        const shortOrderId = order._id
          .toString()
          .slice(-8)
          .toUpperCase();

        await notifyOrder({
          user: order.user,
          orderId: order._id,
          sender: req.user,
          message: `🎉 Your order #${shortOrderId} has been delivered successfully.`,
        });
      }
    } catch (notifyError) {
      console.error(
        "DELIVERY NOTIFICATION ERROR:",
        notifyError.message
      );
    }

    // ========================================
    // GET UPDATED ORDER
    // ========================================

    const updatedOrder = await Order.findById(order._id)
      .populate("user", "name phone email")
      .populate("items.product", "name image");

    // ========================================
    // RESPONSE
    // ========================================

    return res.status(200).json({
      success: true,
      message: "Order marked as delivered successfully",
      data: formatAdminOrder(updatedOrder),
    });
  } catch (error) {
    console.error(
      "DELIVER ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to mark order as delivered",
      error: error.message,
    });
  }
};

// =========================================================
// ADMIN UPDATE PAYMENT STATUS
// =========================================================

const updatePaymentStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { paymentStatus } =
      req.body;

    const allowedStatuses = [
      "pending",
      "paid",
      "failed",
      "refunded",
    ];

    if (
      !allowedStatuses.includes(
        paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment status",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order ID",
      });
    }

    const order =
      await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found",
      });
    }

    // ========================================
    // CANCELLED ORDER
    // ========================================

    if (
      order.status ===
      "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled orders cannot have their payment updated",
      });
    }

    // ========================================
    // UPDATE PAYMENT
    // ========================================

    order.paymentStatus =
      paymentStatus;

    // If admin marks payment as paid,
    // move the order into processing.

    if (
      paymentStatus === "paid" &&
      order.status === "pending"
    ) {
      order.status =
        "processing";
    }

    await order.save();

    // ========================================
    // NOTIFICATION
    // ========================================

    try {
      if (order.user) {
        await notifyOrder({
          user: order.user,

          orderId: order._id,

          sender: req.user,

          message:
            `Your payment status is now ${paymentStatus}.`,
        });
      }
    } catch (notifyError) {
      console.error(
        "PAYMENT NOTIFICATION ERROR:",
        notifyError.message
      );
    }

    // ========================================
    // UPDATED ORDER
    // ========================================

    const updatedOrder =
      await Order.findById(
        order._id
      )
        .populate(
          "user",
          "name phone email"
        )
        .populate(
          "items.product",
          "name image"
        );

    return res.status(200).json({
      success: true,

      message:
        "Payment status updated successfully",

      data:
        formatAdminOrder(
          updatedOrder
        ),
    });
  } catch (error) {
    console.error(
      "UPDATE PAYMENT STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update payment status",
      error: error.message,
    });
  }
};

// =========================================================
// ADMIN GET PAYMENTS
// =========================================================

const getAdminPayments = async (
  req,
  res
) => {
  try {
    const orders =
      await Order.find({
        paymentStatus: {
          $in: [
            "pending",
            "paid",
          ],
        },
      })
        .populate(
          "user",
          "name email phone"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error(
      "GET ADMIN PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch payments",
    });
  }
};

const confirmOrderReceipt = async (req, res) => {
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

    // Customer must own the order
    if (
      order.user &&
      order.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to confirm this order",
      });
    }

    // If the order hasn't been marked delivered yet, allow
    // customers to confirm receipt when the package is
    // currently marked as "shipped". This makes UX simpler
    // for cases where courier marking is delayed.
    if (order.shippingStatus !== "delivered") {
      if (order.shippingStatus === "shipped") {
        // mark shipment delivered
        order.shippingStatus = "delivered";

        // ensure shipping object exists and set deliveredAt
        order.shipping = order.shipping || {};
        if (!order.shipping.deliveredAt) {
          order.shipping.deliveredAt = new Date();
        }

        // also update overall order status to delivered
        order.status = "delivered";
      } else {
        return res.status(400).json({
          success: false,
          message:
            "You can only confirm receipt after the order has been delivered",
        });
      }
    }

    // Prevent double-confirmation. Use shipping nested flag when available.
    const alreadyConfirmed =
      Boolean(order.shipping?.customerConfirmed) ||
      Boolean(order.customerConfirmedDelivery);

    if (alreadyConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Receipt has already been confirmed",
      });
    }

    // Mark customer-confirmation on both the nested shipping object
    // (schema field) and on some compatibility aliases so the
    // formatted response includes the flags clients expect.
    order.shipping = order.shipping || {};
    order.shipping.customerConfirmed = true;
    order.shipping.customerConfirmedAt = new Date();

    // compatibility/top-level aliases (kept in-memory so formatAdminOrder picks them up)
    order.customerConfirmed = true;
    order.customerConfirmedAt = order.shipping.customerConfirmedAt;
    order.receiptConfirmed = true;
    order.receiptConfirmedAt = order.shipping.customerConfirmedAt;
    order.deliveryConfirmed = true;
    order.deliveryConfirmedAt = order.shipping.customerConfirmedAt;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order receipt confirmed successfully",
      data: formatAdminOrder(order),
    });
  } catch (error) {
    console.error(
      "CONFIRM ORDER RECEIPT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to confirm order receipt",
      error: error.message,
    });
  }
};

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  formatAdminOrder,
  createOrder,
  getAllOrders,
  getAdminOrder,
  getMyOrders,
  getOrder,
  submitPayment,
  confirmPayment,
  updateOrderStatus,
  updatePaymentStatus,
  getAdminPayments,
  shipOrder,
  deliverOrder,
  confirmOrderReceipt,
};

