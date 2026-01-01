const extract = require('./api/extract-with-exports.js');
const fs = require('fs');

const fbCookies = JSON.parse(fs.readFileSync('fb-cookies.json', 'utf8'));

async function testPeriod(period) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Probando: ${period}`);
  console.log(`${'='.repeat(50)}`);
  
  const req = { 
    body: { 
      cookies: fbCookies, 
      period: period 
    },
    method: 'POST'
  };
  
  let result = null;
  const res = {
    json: (data) => {
      result = data;
      console.log(`✅ Éxito!`);
      console.log(`  - Período: ${data.period}`);
      console.log(`  - Líneas CSV: ${data.csvLines}`);
      console.log(`  - Métricas extraídas: ${Object.entries(data.metrics).filter(([_, m]) => m.totalPoints > 0).map(([name, m]) => `${name}(${m.totalPoints})`).join(', ')}`);
    },
    status: (code) => ({
      json: (data) => {
        result = data;
        console.log(`❌ Error (${code}): ${data.error}`);
      }
    })
  };
  
  await extract(req, res);
  return result;
}

(async () => {
  const periods = ['LAST_7D', 'LAST_28D'];
  
  for (const period of periods) {
    try {
      await testPeriod(period);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
})();
