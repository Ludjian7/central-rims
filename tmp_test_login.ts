import axios from 'axios';

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'owner',
      password: 'owner123'
    });
    console.log('--- TEST LOGIN SUCCESS ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('--------------------------');
  } catch (error: any) {
    console.log('--- TEST LOGIN FAILED ---');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Message:', error.message);
    console.log('-------------------------');
  }
}

testLogin();
