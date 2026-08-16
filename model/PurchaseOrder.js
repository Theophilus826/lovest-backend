const mongoose = require("mongoose");

/*
|--------------------------------------------------------------------------
| CONTRIBUTION
|--------------------------------------------------------------------------
| Customer contributes little by little using:
| - 4 phases
| - 6 phases
| - 7 phases
|--------------------------------------------------------------------------
*/

const contributionSchema = new mongoose.Schema(
  {
    phases: {
      type: Number,
      enum: [4, 6, 7],
      required: true,
    },

    currentPhase: {
      type: Number,
      default: 0,
      min: 0,
    },

    amountPerPhase: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "DEFAULTED",
      ],
      default: "ACTIVE",
    },

    nextPaymentDue: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);


/*
|--------------------------------------------------------------------------
| NORMAL / FULL PAYMENT
|--------------------------------------------------------------------------
*/

const paymentSchema = new mongoose.Schema(
  {
    requiredAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "PARTIAL",
        "PAID",
        "FAILED",
      ],
      default: "PENDING",
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);


/*
|--------------------------------------------------------------------------
| LOAN
|--------------------------------------------------------------------------
| Customer buys the product on loan and pays back later.
|--------------------------------------------------------------------------
*/

const loanSchema = new mongoose.Schema(
  {
    productAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    deposit: {
      type: Number,
      default: 0,
      min: 0,
    },

    loanAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    approvedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    repaymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    repaymentMonths: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRepayment: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "ACTIVE",
        "COMPLETED",
        "DEFAULTED",
      ],
      default: "PENDING_APPROVAL",
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);


/*
|--------------------------------------------------------------------------
| BUY TO RESELL
|--------------------------------------------------------------------------
| Customer purchases products for resale.
|--------------------------------------------------------------------------
*/

const resellerSchema = new mongoose.Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "PAID",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PENDING",
    },
  },
  {
    _id: false,
  }
);


/*
|--------------------------------------------------------------------------
| RECEIVING PAYMENT
|--------------------------------------------------------------------------
| Each individual payment received from the customer.
|
| Examples:
|
| - First contribution
| - Second contribution
| - Loan deposit
| - Loan repayment
| - Full payment
| - Reseller payment
|--------------------------------------------------------------------------
*/

const receivingSchema = new mongoose.Schema(
  {
    /*
    |----------------------------------------------------------------------
    | AMOUNT RECEIVED
    |----------------------------------------------------------------------
    */

    amount: {
      type: Number,
      required: true,
      min: 0,
    },


    /*
    |----------------------------------------------------------------------
    | PAYMENT METHOD
    |----------------------------------------------------------------------
    */

    paymentMethod: {
      type: String,
      enum: [
        "CASH",
        "BANK_TRANSFER",
        "CARD",
        "PAYSTACK",
        "FLUTTERWAVE",
        "OTHER",
      ],
      default: "CASH",
    },


    /*
    |----------------------------------------------------------------------
    | PAYMENT REFERENCE
    |----------------------------------------------------------------------
    | Useful for bank transfer / online payments.
    */

    reference: {
      type: String,
      default: "",
      trim: true,
    },


    /*
    |----------------------------------------------------------------------
    | DATE PAYMENT WAS RECEIVED
    |----------------------------------------------------------------------
    */

    receivedAt: {
      type: Date,
      default: Date.now,
    },


    /*
    |----------------------------------------------------------------------
    | ADMIN WHO RECEIVED THE PAYMENT
    |----------------------------------------------------------------------
    */

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },


    /*
    |----------------------------------------------------------------------
    | NOTE
    |----------------------------------------------------------------------
    */

    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: true,
  }
);


/*
|--------------------------------------------------------------------------
| PURCHASE ORDER
|--------------------------------------------------------------------------
*/

const purchaseOrderSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | CUSTOMER
    |--------------------------------------------------------------------------
    */

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },


    /*
    |--------------------------------------------------------------------------
    | PRODUCT
    |--------------------------------------------------------------------------
    */

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },


    /*
    |--------------------------------------------------------------------------
    | PURCHASE TYPE
    |--------------------------------------------------------------------------
    |
    | FULL_PAYMENT
    |     Customer pays everything immediately.
    |
    | CONTRIBUTION
    |     Customer contributes over 4, 6 or 7 phases.
    |
    | LOAN
    |     Customer buys on credit/loan.
    |
    | RESELL
    |     Customer buys products to resell.
    |
    */

    purchaseType: {
      type: String,
      enum: [
        "FULL_PAYMENT",
        "CONTRIBUTION",
        "LOAN",
        "RESELL",
      ],
      required: true,
      index: true,
    },


    /*
    |--------------------------------------------------------------------------
    | PURCHASE ORDER STATUS
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,

      enum: [
        "PENDING_PAYMENT",

        // Contribution
        "CONTRIBUTION_ACTIVE",

        // Loan
        "PENDING_LOAN_APPROVAL",
        "LOAN_APPROVED",

        // General order processing
        "PROCESSING",
        "READY_FOR_DELIVERY",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",

        "CANCELLED",
      ],

      default: "PENDING_PAYMENT",

      index: true,
    },


    /*
    |--------------------------------------------------------------------------
    | NORMAL PAYMENT
    |--------------------------------------------------------------------------
    */

    payment: {
      type: paymentSchema,
      default: null,
    },


    /*
    |--------------------------------------------------------------------------
    | CONTRIBUTION
    |--------------------------------------------------------------------------
    */

    contribution: {
      type: contributionSchema,
      default: null,
    },


    /*
    |--------------------------------------------------------------------------
    | LOAN
    |--------------------------------------------------------------------------
    */

    loan: {
      type: loanSchema,
      default: null,
    },


    /*
    |--------------------------------------------------------------------------
    | RESELL
    |--------------------------------------------------------------------------
    */

    reseller: {
      type: resellerSchema,
      default: null,
    },


    /*
    |--------------------------------------------------------------------------
    | RECEIVING
    |--------------------------------------------------------------------------
    | This is the admin receiving point.
    |
    | It keeps:
    |
    | totalReceived
    |     Total money received so far.
    |
    | remainingAmount
    |     Amount the customer still owes.
    |
    | payments
    |     Every individual payment received.
    |
    | status
    |     Current receiving/payment state.
    |--------------------------------------------------------------------------
    */

    receiving: {
      /*
      |----------------------------------------------------------------------
      | TOTAL RECEIVED
      |----------------------------------------------------------------------
      */

      totalReceived: {
        type: Number,
        default: 0,
        min: 0,
      },


      /*
      |----------------------------------------------------------------------
      | REMAINING AMOUNT
      |----------------------------------------------------------------------
      */

      remainingAmount: {
        type: Number,
        default: 0,
        min: 0,
      },


      /*
      |----------------------------------------------------------------------
      | PAYMENT HISTORY
      |----------------------------------------------------------------------
      */

      payments: {
        type: [receivingSchema],
        default: [],
      },


      /*
      |----------------------------------------------------------------------
      | RECEIVING STATUS
      |----------------------------------------------------------------------
      */

      status: {
        type: String,
        enum: [
          "PENDING",
          "PARTIAL",
          "PAID",
          "COMPLETED",
        ],
        default: "PENDING",
      },
    },


    /*
    |--------------------------------------------------------------------------
    | DELIVERY
    |--------------------------------------------------------------------------
    */

    delivery: {
      address: {
        type: String,
        default: "",
        trim: true,
      },

      city: {
        type: String,
        default: "",
        trim: true,
      },

      state: {
        type: String,
        default: "",
        trim: true,
      },

      phone: {
        type: String,
        default: "",
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "PENDING",
          "PROCESSING",
          "SHIPPED",
          "DELIVERED",
        ],
        default: "PENDING",
      },

      trackingNumber: {
        type: String,
        default: "",
        trim: true,
      },
    },


    /*
    |--------------------------------------------------------------------------
    | COMPLETION
    |--------------------------------------------------------------------------
    */

    completedAt: {
      type: Date,
      default: null,
    },


    /*
    |--------------------------------------------------------------------------
    | CANCELLATION
    |--------------------------------------------------------------------------
    */

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: "",
      trim: true,
    },
  },

  {
    timestamps: true,
  }
);


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);