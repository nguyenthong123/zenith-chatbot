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
  const total = snapshot.size;
  let guests = 0;
  let realEmails = 0;
  let emptyEmails = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const email = data.email || "";
    if (email.startsWith("guest-") || email.endsWith("@example.com")) {
      guests++;
    } else if (email) {
      realEmails++;
      if (realEmails < 5) console.log(`Real Email: ${email}`);
    } else {
      emptyEmails++;
    }
  });

  console.log(`Total: ${total}`);
  console.log(`Guests: ${guests}`);
  console.log(`Real Emails: ${realEmails}`);
  console.log(`Empty Emails: ${emptyEmails}`);
}

analyzeUsers().catch(console.error);
