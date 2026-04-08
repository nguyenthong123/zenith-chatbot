import * as admin from "firebase-admin";

const serviceAccount = require("../config/service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

async function listDocs() {
  const collections = await firestore.listCollections();
  console.log(
    "Collections:",
    collections.map((c) => c.id),
  );

  // Also check if 'products' has any docs
  const pSize = await firestore.collection("products").limit(1).get();
  console.log("Products docs found:", !pSize.empty);

  process.exit(0);
}

listDocs();
