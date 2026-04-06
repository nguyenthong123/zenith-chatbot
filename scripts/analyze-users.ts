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

async function analyzeUsers() {
  const snapshot = await firestore.collection("users").get();
  const _total = snapshot.size;
  let _guests = 0;
  let _realEmails = 0;
  let _emptyEmails = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const email = data.email || "";
    if (email.startsWith("guest-") || email.endsWith("@example.com")) {
      _guests++;
    } else if (email) {
      _realEmails++;
    } else {
      _emptyEmails++;
    }
  });
}

// biome-ignore lint/suspicious/noConsole: script entry point
analyzeUsers().catch(console.error);
