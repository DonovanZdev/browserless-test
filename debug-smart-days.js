const https = require('https');
const { URL } = require('url');

function parseCookies(cookies) {
  if (!cookies) return '';
  
  if (typeof cookies === 'string') {
    try {
      let cookieString = cookies.trim();
      if ((cookieString.startsWith('"') && cookieString.endsWith('"')) ||
          (cookieString.startsWith("'") && cookieString.endsWith("'"))) {
        cookieString = cookieString.slice(1, -1);
      }
      cookies = JSON.parse(cookieString);
    } catch (e) {
      return '';
    }
  }

  let cookieString = '';
  
  if (Array.isArray(cookies)) {
    if (cookies[0] && cookies[0].name && cookies[0].value) {
      cookieString = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } else if (typeof cookies[0] === 'object' && !cookies[0].name) {
      const cookieObj = cookies[0];
      cookieString = Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
  } else if (typeof cookies === 'object') {
    cookieString = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  
  return cookieString;
}

async function makeRequest(url, cookieHeader) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.tiktok.com/',
        'Cookie': cookieHeader
      }
    };

    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    request.on('error', (e) => {
      reject(e);
    });

    request.end();
  });
}

async function extractHistoricalSmartDays(cookies, yearMonth) {
  const cookieHeader = parseCookies(cookies);
  if (!cookieHeader) throw new Error('No valid cookies');

  // Parse yearMonth "2025-11"
  const [year, month] = yearMonth.split('-');
  const parsedYear = parseInt(year);
  const parsedMonth = parseInt(month) - 1;
  
  const firstDay = new Date(parsedYear, parsedMonth, 1);
  const lastDay = new Date(parsedYear, parsedMonth + 1, 0);
  const daysPeriod = lastDay.getDate();
  
  console.log(`\n📅 Extrayendo: ${firstDay.toLocaleDateString('es-MX')} a ${lastDay.toLocaleDateString('es-MX')} (${daysPeriod} días)`);
  
  // Estrategia: probar múltiples valores de days cercanos
  // El rango típico es daysPeriod +/- offset según el día actual
  const now = new Date();
  const testRange = [];
  
  // Crear rango de prueba
  for (let offset = -5; offset <= 10; offset++) {
    testRange.push(daysPeriod + offset);
  }
  
  console.log(`\n🔍 Probando ${testRange.length} variaciones de 'days'...\n`);

  let bestResult = { days: 0, dataPoints: 0, values: [] };

  for (const daysValue of testRange) {
    try {
      const typeRequests = [
        { "insigh_type": "vv_history", "days": daysValue, "end_days": 0 }
      ];

      const baseUrl = "https://www.tiktok.com/aweme/v2/data/insight/";
      const params = new URLSearchParams({
        locale: "en",
        aid: "1988",
        priority_region: "MX",
        tz_name: "America/Mexico_City",
        app_name: "tiktok_creator_center",
        app_language: "en",
        device_platform: "web_pc",
        channel: "tiktok_web",
        device_id: "7586552972738463288",
        os: "win",
        tz_offset: "-6",
        type_requests: JSON.stringify(typeRequests)
      });

      const url = `${baseUrl}?${params.toString()}`;
      const result = await makeRequest(url, cookieHeader);

      if (result.status_code !== 0) {
        console.log(`  ❌ days=${daysValue}: API error - ${result.status_msg}`);
        continue;
      }

      const vvValues = (result.vv_history || [])
        .filter(item => item && item.status === 0)
        .map(item => item.value || 0)
        .slice(0, daysPeriod);

      // Contar puntos de datos (non-zero values)
      const dataPoints = vvValues.filter(v => v > 0).length;
      
      console.log(`  📊 days=${daysValue}: ${vvValues.length} valores (${dataPoints} no-cero) - [${vvValues.slice(0, 5).join(', ')}...]`);

      if (vvValues.length >= daysPeriod && dataPoints > bestResult.dataPoints) {
        bestResult = { days: daysValue, dataPoints, values: vvValues };
      }

    } catch (err) {
      console.log(`  ⚠️  days=${daysValue}: ${err.message}`);
    }
  }

  console.log(`\n✅ Mejor resultado: days=${bestResult.days} con ${bestResult.dataPoints} valores`);
  console.log(`📊 Primeros 10: [${bestResult.values.slice(0, 10).join(', ')}]`);
  
  return {
    yearMonth,
    daysPeriod,
    bestDays: bestResult.days,
    dataPoints: bestResult.dataPoints,
    values: bestResult.values,
    fullResponse: {
      dateRange: {
        from: firstDay.toLocaleDateString('es-MX'),
        to: lastDay.toLocaleDateString('es-MX'),
        totalDays: daysPeriod
      },
      metrics: {
        video_views: bestResult.values
      }
    }
  };
}

// Test
const cookiesFile = require('fs').readFileSync('/Users/donovanadrian/browserless-test/tiktok-cookies.json', 'utf8');
const cookies = JSON.parse(cookiesFile);

(async () => {
  try {
    const result = await extractHistoricalSmartDays(cookies, '2025-11');
    console.log('\n🎯 Resultado final:', JSON.stringify(result.fullResponse, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
