import { prisma } from './src/db/index.js';

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, isActive: true }
  });
  console.log('--- DATABASE USERS ---');
  console.log(JSON.stringify(users, null, 2));
  console.log('----------------------');
  process.exit(0);
}

checkUsers();
