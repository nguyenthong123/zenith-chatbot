import * as dotenv from "dotenv";
import * as admin from "firebase-admin";

dotenv.config();

const serviceAccount = require("/Users/zomby/Desktop/dunvex-89461-firebase-adminsdk-fbsvc-0dcb46d9a3.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function checkAuthUsers() {
  const listUsersResult = await admin.auth().listUsers(1000);

  let _guests = 0;
  let _real = 0;

  listUsersResult.users.forEach((user) => {
    if (user.email?.startsWith("guest-") || !user.email) {
      _guests++;
    } else {
      _real++;
    }
  });
}

checkAuthUsers().catch(console.error);
