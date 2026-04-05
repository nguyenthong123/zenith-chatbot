import * as dotenv from "dotenv";
import * as admin from "firebase-admin";

dotenv.config();

const serviceAccount = require("/Users/zomby/Desktop/dunvex-89461-firebase-adminsdk-fbsvc-0dcb46d9a3.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

async function analyzeCustomers() {
  const snapshot = await firestore.collection("customers").get();
  console.log(`Total customers: ${snapshot.size}`);

  let withEmail = 0;
  snapshot.forEach((doc) => {
    if (
      doc.data().email ||
      doc.data().ownerEmail ||
      doc.data().createdByEmail
    ) {
      withEmail++;
    }
  });
  console.log(`Customers with any email field: ${withEmail}`);
}

analyzeCustomers().catch(console.error);
