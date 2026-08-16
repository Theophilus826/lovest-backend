
const admin = require("firebase-admin");
const serviceAccount = require("../lovest-sales-firebase-adminsdk-fbsvc-23048c1ac9.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

