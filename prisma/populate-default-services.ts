async function populateProduction() {
  const baseURL = 'http://localhost:5000/api/v1';
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
    console.log('Logged in! Setting up services...');

    // Helper to update service
    const updateService = async (id: number, payload: any) => {
      const res = await fetch(`${baseURL}/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`Updated Service ${id}:`, data.success ? 'Success' : data);
    };

    // 1. Deactivate old "Standard Washing" (serviceType is "Standard Washing" which app rejects)
    await updateService(15, { isActive: false });

    // 2. Activate default services
    await updateService(12, { isActive: true }); // Wash & Fold (Washing)
    await updateService(11, { isActive: true }); // Dry Clean (Dry Cleaning)
    await updateService(7, { isActive: true });  // Steam Press (Ironing)

    // 3. Create or find Double Bedsheet product
    console.log('Fetching products...');
    const productsRes = await fetch(`${baseURL}/services/admin/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const productsData = await productsRes.json();
    let bedsheetProductId: number | null = null;
    let shirtProductId = 73; // Default shirt product ID from DB

    if (productsData.success) {
      for (const p of productsData.data) {
        if (p.name.toLowerCase().includes('bedsheet') || p.name.toLowerCase().includes('sheet')) {
          bedsheetProductId = p.id;
        }
        if (p.name.toLowerCase() === "men's shirt") {
          shirtProductId = p.id;
        }
      }
    }

    if (!bedsheetProductId) {
      console.log('Creating Bedsheet product...');
      const createProdRes = await fetch(`${baseURL}/services/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Double Bedsheet',
          emoji: '🛏️',
          isActive: true
        })
      });
      const prodData = await createProdRes.json();
      if (prodData.success) {
        bedsheetProductId = prodData.data.id;
        console.log(`Created Bedsheet product with ID: ${bedsheetProductId}`);
      } else {
        console.error('Failed to create Bedsheet product:', prodData);
      }
    } else {
      console.log(`Found existing Bedsheet product with ID: ${bedsheetProductId}`);
    }

    // 4. Create default price rules (Service + Product + DEFAULT pincode -> Price)
    const createPriceRule = async (serviceId: number, productId: number, price: number) => {
      console.log(`Creating price rule for Service ${serviceId} + Product ${productId} -> ₹${price}...`);
      const res = await fetch(`${baseURL}/services/admin/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serviceId,
          productId,
          pincode: 'DEFAULT',
          price,
          isActive: true
        })
      });
      const data = await res.json();
      console.log(`Price Rule result:`, data.success ? 'Success' : data.message || data);
    };

    // Add default price rules for Men's Shirt (ID: shirtProductId)
    if (shirtProductId) {
      await createPriceRule(12, shirtProductId, 79);  // Wash & Fold (Washing) -> ₹79
      await createPriceRule(11, shirtProductId, 109); // Dry Clean (Dry Cleaning) -> ₹109
      await createPriceRule(7, shirtProductId, 15);   // Steam Press (Ironing) -> ₹15
    }

    // Add default price rule for Bedsheet
    if (bedsheetProductId) {
      await createPriceRule(7, bedsheetProductId, 79); // Steam Press + Bedsheet -> ₹79
    }

    console.log('Seeding process completed!');

  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

populateProduction();
