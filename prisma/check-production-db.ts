async function checkProduction() {
  const baseURL = 'https://veenatinnovations-laundry-api.onrender.com/api/v1';
  try {
    console.log('Logging in as Admin...');
    const loginRes = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@laundry.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed:', loginData);
      return;
    }

    const token = loginData.data.accessToken;
    console.log('Logged in! Fetching admin data...');

    // 1. Fetch all products
    const productsRes = await fetch(`${baseURL}/services/admin/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const productsData = await productsRes.json();
    console.log('--- Products ---');
    console.log(JSON.stringify(productsData, null, 2));

    // 2. Fetch all services
    const servicesRes = await fetch(`${baseURL}/services/admin/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const servicesData = await servicesRes.json();
    console.log('--- Services ---');
    console.log(JSON.stringify(servicesData, null, 2));

    // 3. Fetch all prices
    const pricesRes = await fetch(`${baseURL}/services/admin/prices`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pricesData = await pricesRes.json();
    console.log('--- Prices ---');
    console.log(JSON.stringify(pricesData, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkProduction();
