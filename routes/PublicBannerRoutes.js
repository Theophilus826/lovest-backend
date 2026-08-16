const express = require("express");

const {
  getActiveBanners,
} = require("../controllers/BannerController");

const router = express.Router();

router.get("/", getActiveBanners);

module.exports = router;