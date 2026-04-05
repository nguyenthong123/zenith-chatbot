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

async function sampleUsers() {
  const snapshot = await firestore.collection("users").limit(10).get();
  console.log("Sample users format:");
  snapshot.forEach((doc) => {
    console.log(`ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log("-------------------");
  });
}

sampleUsers().catch(console.error);
