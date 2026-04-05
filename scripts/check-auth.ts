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
  console.log(`Total Auth Users: ${listUsersResult.users.length}`);

  let guests = 0;
  let real = 0;

  listUsersResult.users.forEach((user) => {
    if (user.email?.startsWith("guest-") || !user.email) {
      guests++;
    } else {
      real++;
      if (real < 5) console.log(`Real Auth User: ${user.email}`);
    }
  });

  console.log(`Auth Guests: ${guests}`);
  console.log(`Auth Real: ${real}`);
}

checkAuthUsers().catch(console.error);
