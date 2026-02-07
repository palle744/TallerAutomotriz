
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function runTest() {
    try {
        // 1. Create Vehicle
        console.log('Creating vehicle...');
        const vehicleRes = await axios.post(`${BASE_URL}/vehicles`, {
            plate: 'TEST-BAL-' + Math.floor(Math.random() * 10000),
            brand: 'TestBrand',
            model: 'TestModel',
            year: 2025,
            color: 'Green',
            entry_reason: 'Balance Test',
            owner_name: 'Tester',
            contact_phone: '1234567890'
        });
        const vehicleId = vehicleRes.data.id;
        console.log(`Vehicle ID: ${vehicleId}`);

        // 2. Create Estimate ($100)
        console.log('Creating Estimate ($100)...');
        await axios.post(`${BASE_URL}/estimates`, {
            vehicle_id: vehicleId,
            total_amount: 100,
            data: [{ name: 'Service', cost: 100 }]
        });

        // Auto-approve estimate (since logic relies on approved_amount)
        // Need to fetch estimate ID first
        const estList = await axios.get(`${BASE_URL}/estimates/vehicle/${vehicleId}`);
        // The endpoint returns details directly if found, but based on reading code it might be null if not found
        // Actually the code: `res.json(result.rows[0]);` returns object.
        const estId = estList.data.id;

        console.log(`Approving Estimate ${estId}...`);
        await axios.put(`${BASE_URL}/estimates/${estId}/approval`, {
            approved_amount: 100,
            approval_notes: 'Auto Approved'
        });

        // 3. Payment 1: $50 (Should Succeed)
        console.log('Paying $50...');
        await axios.post(`${BASE_URL}/payments`, {
            vehicle_id: vehicleId,
            amount: 50,
            payment_method: 'Efectivo',
            notes: 'Partial Payment'
        });
        console.log('✅ Payment 1 Success (Balance should be 50)');

        // 4. Payment 2: $60 (Should Fail - Overpayment)
        console.log('Paying $60 (Should Fail)...');
        try {
            await axios.post(`${BASE_URL}/payments`, {
                vehicle_id: vehicleId,
                amount: 60,
                payment_method: 'Tarjeta',
                notes: 'Overpayment'
            });
            console.log('❌ FAILURE: Overpayment succeeded.');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('✅ SUCCESS: Overpayment blocked.');
                console.log('Error:', err.response.data.error);
            } else {
                console.log('❌ FAILURE: Unexpected error:', err.message);
            }
        }

        // 5. Payment 3: $50 (Should Succeed - Full Payment)
        console.log('Paying $50 (Final)...');
        await axios.post(`${BASE_URL}/payments`, {
            vehicle_id: vehicleId,
            amount: 50,
            payment_method: 'Efectivo',
            notes: 'Final Payment'
        });
        console.log('✅ Payment 3 Success (Balance should be 0)');

        // 6. Payment 4: $10 (Should Fail - No Balance)
        console.log('Paying $10 (Should Fail)...');
        try {
            await axios.post(`${BASE_URL}/payments`, {
                vehicle_id: vehicleId,
                amount: 10,
                payment_method: 'Efectivo',
                notes: 'Extra Payment'
            });
            console.log('❌ FAILURE: Extra payment succeeded.');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('✅ SUCCESS: Extra payment blocked.');
                console.log('Error:', err.response.data.error);
            } else {
                console.log('❌ FAILURE: Unexpected error:', err.message);
            }
        }

    } catch (err) {
        console.error('Test Failed:', err.message);
        if (err.response) console.error('Response Data:', err.response.data);
    }
}

runTest();
