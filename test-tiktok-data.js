const https = require('https');
const fs = require('fs');

// Leer las cookies convertidas
const cookies = JSON.parse(fs.readFileSync('tiktok-cookies-converted.json', 'utf-8'));

const payload = {
  tiktokCookies: cookies,
  period: 'LAST_28D'
};

const options = {
  hostname: 'browserless-test.vercel.app',
  port: 443,
  path: '/api/extract-tiktok',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(payload))
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.success) {
        console.log("\n========================================");
        console.log("   TIKTOK DATA COMPLETA");
        console.log("========================================\n");
        
        const { metrics } = result.data;
        
        Object.entries(metrics).forEach(([name, metric]) => {
          console.log(`\n📊 ${name.toUpperCase()}`);
          console.log(`  Total: ${metric.totalValue}`);
          console.log(`  Puntos: ${metric.totalPoints}`);
          
          if (metric.historicalData.length > 0) {
            console.log(`  Desglose por día:`);
            metric.historicalData.forEach(day => {
              console.log(`    ${day.fecha}: ${day.valor}`);
            });
          }
        });
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('Error en request:', e.message);
});

req.write(JSON.stringify(payload));
req.end();
