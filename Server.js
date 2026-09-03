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
// START SERVER
// ==========================
const startServer = async () => {
  try {
    // ==========================
    // CONNECT TO DATABASE
    // ==========================
    await connectDB();

    // ==========================
    // CORS
    // ==========================

    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://lovest-mmwz.onrender.com",
    ];

    // Add FRONTEND_URL from Render environment
    // if it exists and isn't already in the list.
    const corsOptions = {
      origin: function (origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin?.includes("onrender.com")
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Accept",
      ],
      optionsSuccessStatus: 200,
    };

    app.use(cors(corsOptions));

    app.use((req, res, next) => {
      const origin = req.headers.origin;

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin?.includes("onrender.com")
      ) {
        res.header("Access-Control-Allow-Origin", origin || "*");
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Credentials", "true");
        res.header(
          "Access-Control-Allow-Methods",
          "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        );
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With, Origin, Accept",
        );
      }

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      const contentLength = req.headers["content-length"];

      if (contentLength && Number(contentLength) > 300 * 1024 * 1024) {
        return res.status(413).json({
          message: "File too large. Max 300MB allowed.",
        });
      }

      next();
    });

    // ==========================
    // MIDDLEWARE
    // ==========================

    app.use(cookieParser());

    app.use(express.json());

    app.use(
      express.urlencoded({
        extended: true,
      }),
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

    app.use("/api/admin/purchase-orders", adminReceivingRoutes);

    app.use("/api/discounts", discountPublicRoutes);

    app.use("/api/admin/discounts", discountRoutes);

    app.use("/api/purchase", PurchaseRoutes);

    app.use("/api/purchases", PurchaseRoutes);

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
    // START LISTENING
    // ==========================

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log("=================================");
      console.log("🚀 Server started successfully");
      console.log(`📡 Port: ${PORT}`);
      console.log("=================================");
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
