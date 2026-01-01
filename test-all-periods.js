const extract = require('./api/extract-with-exports.js');
const fs = require('fs');

const fbCookies = JSON.parse(fs.readFileSync('fb-cookies.json', 'utf8'));

async function testPeriod(period) {
  const req = { 
    body: { cookies: fbCookies, period: period },
    method: 'POST'
  };
  
  let result = null;
  const res = {
    json: (data) => { result = data; },
    status: (code) => ({ json: (data) => { result = data; } })
  };
  
  try {
    await extract(req, res);
    const totalPoints = Object.values(result.metrics || {}).reduce((sum, m) => sum + (m.totalPoints || 0), 0);
    const status = totalPoints > 0 ? '✅' : '❌';
    console.log(`${status} ${period.padEnd(15)}: ${totalPoints} puntos totales`);
    return result;
  } catch (error) {
    console.log(`❌ ${period.padEnd(15)}: Error - ${error.message}`);
    return null;
  }
}

(async () => {
  // Solo probar períodos que Facebook realmente ofrece en la UI
  const validPeriods = ['LAST_28D', 'LAST_90D', 'THIS_WEEK', 'THIS_MONTH', 'LAST_WEEK', 'LAST_MONTH', 'THIS_YEAR'];
  
  console.log('\n🧪 Probando períodos disponibles en Facebook:\n');
  
  for (const period of validPeriods) {
    await testPeriod(period);
  }
})();
