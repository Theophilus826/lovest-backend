/**
 * ============================================================
 * PAYSTACK MANDATE CALLBACK
 *
 * GET /api/mandates/callback
 *
 * This backend is the shared Paystack callback backend.
 *
 * The LOAN backend created the mandate, but Paystack returns
 * the customer to this FIRST backend.
 *
 * We do NOT access the loan database here.
 * We do NOT import MandateService here.
 * We only redirect the customer to the loan website.
 * ============================================================
 */
const callback = async (req, res) => {
  try {
    const reference =
      req.query.reference ||
      req.query.trxref;

    console.log(
      "================================="
    );

    console.log(
      "PAYSTACK MANDATE CALLBACK"
    );

    console.log(
      "Reference:",
      reference
    );

    console.log(
      "Trxref:",
      req.query.trxref
    );

    console.log(
      "================================="
    );

    /**
     * ----------------------------------------------------------
     * CHECK REFERENCE
     * ----------------------------------------------------------
     */

    if (!reference) {
      console.error(
        "PAYSTACK CALLBACK: Missing reference"
      );

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Mandate Error</title>
          </head>

          <body>
            <h2>Missing mandate reference</h2>

            <p>
              We could not identify your mandate.
            </p>

            <p>
              Please return to the loan application.
            </p>
          </body>
        </html>
      `);
    }

    /**
     * ----------------------------------------------------------
     * ONLY HANDLE LOAN MANDATE REFERENCES
     * ----------------------------------------------------------
     *
     * Your loan backend generates references like:
     *
     * MND-1789816489923-49f517409d613082
     *
     * Product payment references should NOT be redirected
     * to the loan website.
     */

    const mandateReference =
      String(reference).trim();

    if (
      !mandateReference
        .toUpperCase()
        .startsWith("MND-")
    ) {
      console.log(
        "Non-loan Paystack reference:",
        mandateReference
      );

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Invalid Mandate</title>
          </head>

          <body>
            <h2>Invalid mandate reference</h2>

            <p>
              This Paystack transaction is not a loan mandate.
            </p>
          </body>
        </html>
      `);
    }

    /**
     * ----------------------------------------------------------
     * LOAN FRONTEND
     * ----------------------------------------------------------
     *
     * Configure this on the FIRST backend:
     *
     * LOAN_FRONTEND_URL=https://your-loan-website.onrender.com
     */

    const loanFrontendUrl =
      process.env.LOAN_FRONTEND_URL;

    if (!loanFrontendUrl) {
      console.error(
        "LOAN_FRONTEND_URL is not configured"
      );

      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Configuration Error</title>
          </head>

          <body>
            <h2>Configuration error</h2>

            <p>
              The loan application URL is not configured.
            </p>

            <p>
              Please contact support.
            </p>
          </body>
        </html>
      `);
    }

    /**
     * ----------------------------------------------------------
     * BUILD LOAN FRONTEND REDIRECT
     * ----------------------------------------------------------
     *
     * Change "/repayment-mandate" if your actual loan
     * frontend route is different.
     */

    const redirectUrl = new URL(
      "/repayment-mandate",
      loanFrontendUrl
    );

    redirectUrl.searchParams.set(
      "reference",
      mandateReference
    );

    redirectUrl.searchParams.set(
      "mandate_return",
      "1"
    );

    /**
     * Preserve Paystack trxref when available.
     */

    if (req.query.trxref) {
      redirectUrl.searchParams.set(
        "trxref",
        String(req.query.trxref)
      );
    }

    /**
     * ----------------------------------------------------------
     * REDIRECT
     * ----------------------------------------------------------
     */

    console.log(
      "Redirecting customer to loan frontend:"
    );

    console.log(
      redirectUrl.toString()
    );

    return res.redirect(
      302,
      redirectUrl.toString()
    );
  } catch (error) {
    console.error(
      "PAYSTACK MANDATE CALLBACK ERROR:",
      error
    );

    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Callback Error</title>
        </head>

        <body>
          <h2>Something went wrong</h2>

          <p>
            We could not complete the mandate return.
          </p>

          <p>
            Please return to the loan application.
          </p>
        </body>
      </html>
    `);
  }
};

module.exports = {
  callback,
};
