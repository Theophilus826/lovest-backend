const express = require("express");
const {
  validateDiscount,
} = require("../controllers/DiscountController");

const router = express.Router();

router.post("/validate", validateDiscount);

module.exports = router;