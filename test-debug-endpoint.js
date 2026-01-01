const axios = require('axios');
const fs = require('fs');

const testPayload = require('./n8n-cookies-config.json');

async function testDebug() {
  try {
    const payload = {
      tiktokCookies: testPayload.tiktokCookies,
      period: 'LAST_28D'
    };

    console.log('📤 Calling endpoint...\n');
    
    const response = await axios.post(
      'https://browserless-test.vercel.app/api/extract-tiktok',
      payload,
      { timeout: 120000 }
    );

    console.log('Response Status:', response.status);
    console.log('\n🔍 Full Response:\n');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data && response.data.data.metrics) {
      console.log('\n📊 Metrics Breakdown:');
      Object.entries(response.data.data.metrics).forEach(([name, data]) => {
        console.log(`\n  ${name}:`);
        console.log(`    - total: ${data.totalValue}`);
        console.log(`    - points: ${data.totalPoints}`);
        if (data.historicalData && data.historicalData.length > 0) {
          console.log(`    - first 5: ${data.historicalData.slice(0, 5).map(d => d.valor).join(', ')}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testDebug();
