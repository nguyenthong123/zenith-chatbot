
const { createGuestUser } = require('./lib/db/queries');

async function testGuest() {
  try {
    console.log('Testing createGuestUser...');
    const result = await createGuestUser();
    console.log('Success:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

testGuest();
