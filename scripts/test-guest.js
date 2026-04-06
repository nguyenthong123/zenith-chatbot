const { createGuestUser } = require("./lib/db/queries");

async function testGuest() {
  try {
    const _result = await createGuestUser();
  } catch (_err) {}
}

testGuest();
