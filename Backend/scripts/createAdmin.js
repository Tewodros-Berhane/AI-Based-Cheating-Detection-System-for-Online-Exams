const mongoose = require('mongoose');
const config = require('config');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/user');

const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_CONTACT = process.env.ADMIN_CONTACT;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_CONTACT) {
  console.error('Missing required env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_CONTACT');
  process.exit(1);
}

async function createOrUpdateAdmin() {
  await mongoose.connect(config.get('mongodb.connectionString'));

  const existing = await UserModel.findOne({ emailid: ADMIN_EMAIL });
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (existing) {
    existing.name = ADMIN_NAME;
    existing.password = passwordHash;
    existing.contact = ADMIN_CONTACT;
    existing.type = 'ADMIN';
    existing.status = true;
    await existing.save();
    console.log(`Admin updated: ${ADMIN_EMAIL}`);
  } else {
    await UserModel.create({
      name: ADMIN_NAME,
      emailid: ADMIN_EMAIL,
      password: passwordHash,
      contact: ADMIN_CONTACT,
      type: 'ADMIN',
      status: true
    });
    console.log(`Admin created: ${ADMIN_EMAIL}`);
  }
}

createOrUpdateAdmin()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Failed to create admin:', error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // no-op
    }
    process.exit(1);
  });
