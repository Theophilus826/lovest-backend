// ==========================
// LOAD ENVIRONMENT VARIABLES
// ==========================
require("dotenv").config();

// ==========================
// IMPORTS
// ==========================
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const connectDB = require("./config/Db");
const { errorHandler } = require("./middleware/ErrorMiddleware");

// Routes
const ProductRoutes = require("./routes/ProductRoutes");
const userRoutes = require("./routes/UserRoute");
const adminProductRoutes = require("./routes/AdminProductRoutes");
const CategoryRoutes = require("./routes/CategoryRoutes");
const adminUserRoutes = require("./routes/UserRoute");
const NotificationRoutes = require("./routes/NotificationRoute");
const OrderRoutes = require("./routes/OrderRoutes");
const AdminOrderRoutes = require("./routes/AdminOrderRoutes");
const PaymentRoutes = require("./routes/PaymentRoutes");
const categoryPublicRoutes = require("./routes/categoryPublicRoutes");
const bannerRoutes = require("./routes/BannerRoutes");
const publicBannerRoutes = require("./routes/PublicBannerRoutes");
const PurchaseRoutes = require("./routes/PurchaseRoutes");
const adminReceivingRoutes = require("./routes/AdminReceivingRoutes");
const discountRoutes = require("./routes/DiscountRoutes");
const discountPublicRoutes = require("./routes/DiscountPublicRoutes");

// ==========================
// CREATE EXPRESS APP
// ==========================
const app = express();

// ==========================
// CORS CONFIGURATION
// ==========================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://lovest-pgn9.onrender.com",
];

// Allow FRONTEND_URL from Render environment variables too
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin
    // (Postman, server-to-server requests, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked origin:", origin);

    return callback(
      new Error(`CORS blocked for origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

// IMPORTANT: CORS must come before your routes
app.use(cors(corsOptions));

// Handle browser preflight requests
app.options("/*splat", cors(corsOptions));

// ==========================
// GENERAL MIDDLEWARE
// ==========================
app.use(cookieParser());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ==========================
// HEALTH CHECK
// ==========================
app.get("/", (req, res) => {
  res.status(200).send("Server is running...");
});

app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend connected successfully!",
  });
});

// ==========================
// USER ROUTES
// ==========================
app.use("/api/users", userRoutes);

// ==========================
// PRODUCT ROUTES
// ==========================
app.use("/api/products", ProductRoutes);

// ==========================
// ADMIN PRODUCT ROUTES
// ==========================
app.use("/api/admin/products", adminProductRoutes);

// ==========================
// CATEGORY ROUTES
// ==========================
app.use("/api/admin/categories", CategoryRoutes);
app.use("/api/categories", categoryPublicRoutes);

// ==========================
// ADMIN USER ROUTES
// ==========================
app.use("/api/admin/users", adminUserRoutes);

// ==========================
// ORDER ROUTES
// ==========================
app.use("/api/orders", OrderRoutes);
app.use("/api/admin/orders", AdminOrderRoutes);

// ==========================
// PURCHASE / RECEIVING ROUTES
// ==========================
app.use(
  "/api/admin/purchase-orders",
  adminReceivingRoutes
);

app.use("/api/purchase", PurchaseRoutes);
app.use("/api/purchases", PurchaseRoutes);

// ==========================
// DISCOUNT ROUTES
// ==========================
app.use("/api/discounts", discountPublicRoutes);
app.use("/api/admin/discounts", discountRoutes);

// ==========================
// NOTIFICATION ROUTES
// ==========================
app.use("/api/notifications", NotificationRoutes);

// ==========================
// PAYMENT ROUTES
// ==========================
app.use("/api/payments", PaymentRoutes);

// ==========================
// BANNER ROUTES
// ==========================
app.use("/api/admin/banners", bannerRoutes);
app.use("/api/banners", publicBannerRoutes);

// ==========================
// ERROR HANDLER
// ==========================
app.use(errorHandler);

// ==========================
// START SERVER
// ==========================
const startServer = async () => {
  try {
    // Connect database
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log("=================================");
      console.log("🚀 Server started successfully");
      console.log(`📡 Port: ${PORT}`);
      console.log("=================================");
      console.log("🌐 Allowed CORS origins:");

      allowedOrigins.forEach((origin) => {
        console.log(`   ✅ ${origin}`);
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server");
    console.error(error);

    process.exit(1);
  }
};

// ==========================
// RUN SERVER
// ==========================
startServer();
