const https = require('https');
const fs = require('fs');

// Leer las cookies convertidas
const cookies = JSON.parse(fs.readFileSync('tiktok-cookies-converted.json', 'utf-8'));

const payload = {
  tiktokCookies: cookies,
  period: 'LAST_28D'
};

console.log("\n========================================");
console.log("   TEST ENDPOINT /api/extract-tiktok");
console.log("========================================\n");

console.log("📤 Enviando payload:");
console.log("  - tiktokCookies: " + cookies.length + " cookies");
console.log("  - period: LAST_28D");
console.log("  - JSON size: " + JSON.stringify(payload).length + " bytes\n");

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
    console.log("📥 Response Status:", res.statusCode);
    console.log("📥 Response Headers:", res.headers);
    
    try {
      const result = JSON.parse(data);
      console.log("\n✅ Response válido (JSON):");
      
      if (result.success === false) {
        console.log("❌ Error:", result.error);
        console.log("Hint:", result.hint);
      } else {
        console.log("✅ Extracción exitosa!");
        console.log("\nResultado:");
        console.log("  Timestamp:", result.data.timestamp);
        console.log("  Period:", result.data.period);
        console.log("  Platform:", result.data.platform);
        console.log("\nMétricas:");
        
        Object.entries(result.data.metrics).forEach(([name, metric]) => {
          console.log(`  ${name}:`);
          console.log(`    Total: ${metric.totalValue}`);
          console.log(`    Puntos: ${metric.totalPoints}`);
        });
      }
    } catch (e) {
      console.error("❌ Response no es JSON válido:");
      console.error(data.slice(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error en request:', e.message);
});

req.write(JSON.stringify(payload));
req.end();
