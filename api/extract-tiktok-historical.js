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
    // Si es array de objetos {name, value}
    if (cookies[0] && cookies[0].name && cookies[0].value) {
      cookieString = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } else if (typeof cookies[0] === 'object' && !cookies[0].name) {
      // Si es array con un objeto {key: value}
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

async function extractHistoricalDirect(cookies) {
  console.log('🔐 Preparando cookies para request directo...');
  const cookieHeader = parseCookies(cookies);
  
  if (!cookieHeader) {
    throw new Error('No valid cookies provided');
  }

  console.log('📡 Realizando request HTTP directo al API de TikTok...\n');

  // Obtener mes anterior
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfPrevMonth = new Date(firstOfThisMonth);
  lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 1);
  const firstDayOfPrevMonth = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), 1);

  const daysPeriod = lastDayOfPrevMonth.getDate();
  
  console.log(`📅 Extrayendo: ${firstDayOfPrevMonth.toLocaleDateString('es-MX')} a ${lastDayOfPrevMonth.toLocaleDateString('es-MX')} (${daysPeriod} días)\n`);

  // Construir request al API
  // El parámetro 'days' cuenta hacia ATRÁS desde HOY
  // Para diciembre exacto siendo 6 de enero:
  // Necesitamos: 31 (días de diciembre) + 6 (días de enero) - 1 = 36 días
  
  const daysBack = daysPeriod + now.getDate() - 1;

  console.log(`  Calculado: days=${daysBack} (período=${daysPeriod} + días actuales=${now.getDate()} - 1)\n`);

  const typeRequests = [
    { "insigh_type": "vv_history", "days": daysBack, "end_days": 0 },
    { "insigh_type": "pv_history", "days": daysBack, "end_days": 0 },
    { "insigh_type": "like_history", "days": daysBack, "end_days": 0 },
    { "insigh_type": "comment_history", "days": daysBack, "end_days": 0 },
    { "insigh_type": "share_history", "days": daysBack, "end_days": 0 }
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
  
  console.log('📊 Solicitando datos históricos...');
  const metricsData = await makeRequest(url, cookieHeader);

  if (!metricsData || metricsData.status_code !== 0) {
    throw new Error(`API error: ${metricsData?.status_msg || 'Unknown error'}`);
  }

  // Procesar métricas
  function processMetric(rawArray) {
    if (!rawArray || rawArray.length === 0) return [];
    
    const allCompleted = rawArray
      .filter(item => item && item.status === 0)
      .map(item => item.value || 0);
    
    return allCompleted;
  }

  console.log('📊 Procesando métricas:');
  const vvValues = processMetric(metricsData.vv_history || []);
  const pvValues = processMetric(metricsData.pv_history || []);
  const likeValues = processMetric(metricsData.like_history || []);
  const commentValues = processMetric(metricsData.comment_history || []);
  const shareValues = processMetric(metricsData.share_history || []);

  console.log(`  ├─ video_views: ${vvValues.length} valores`);
  console.log(`  ├─ profile_views: ${pvValues.length} valores`);
  console.log(`  ├─ likes: ${likeValues.length} valores`);
  console.log(`  ├─ comments: ${commentValues.length} valores`);
  console.log(`  └─ shares: ${shareValues.length} valores`);

  // 🔍 DIAGNÓSTICO
  console.log('\n🔍 === DIAGNÓSTICO ===');
  console.log(`  Primeros 10 video_views: [${vvValues.slice(0, 10).join(', ')}]`);
  console.log(`  Esperado en CSV:         [1, 0, 1, 1, 0, 0, 1, 0, 0, 14]`);

  // Generar fechas
  const dates = [];
  for (let i = 0; i < daysPeriod; i++) {
    const date = new Date(firstDayOfPrevMonth);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  // Crear estructura
  const metrics = {
    video_views: {
      total: vvValues.reduce((a, b) => a + (b || 0), 0),
      history: dates.map((date, i) => ({ date, value: vvValues[i] || 0 }))
    },
    profile_views: {
      total: pvValues.reduce((a, b) => a + (b || 0), 0),
      history: dates.map((date, i) => ({ date, value: pvValues[i] || 0 }))
    },
    likes: {
      total: likeValues.reduce((a, b) => a + (b || 0), 0),
      history: dates.map((date, i) => ({ date, value: likeValues[i] || 0 }))
    },
    comments: {
      total: commentValues.reduce((a, b) => a + (b || 0), 0),
      history: dates.map((date, i) => ({ date, value: commentValues[i] || 0 }))
    },
    shares: {
      total: shareValues.reduce((a, b) => a + (b || 0), 0),
      history: dates.map((date, i) => ({ date, value: shareValues[i] || 0 }))
    }
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return {
    timestamp: new Date().toISOString(),
    period: daysPeriod,
    periodDescription: `Mes anterior (${lastDayOfPrevMonth.toLocaleString('es-MX', { month: 'long', year: 'numeric' })})`,
    dateRange: {
      from: formatDate(firstDayOfPrevMonth),
      to: formatDate(lastDayOfPrevMonth),
      totalDays: daysPeriod
    },
    query_date: lastDayOfPrevMonth.toISOString().split('T')[0],
    metrics: metrics
  };
}

// Exportar para serverless
module.exports = async (req, res) => {
  try {
    const cookiesInput = req.body?.cookies || req.query?.cookies;
    
    if (!cookiesInput) {
      return res.status(400).json({
        error: "Missing cookies parameter",
        message: "Please provide cookies in request body or query parameter"
      });
    }

    const cookies = typeof cookiesInput === 'string' ? JSON.parse(cookiesInput) : cookiesInput;
    
    console.log('\n========================================');
    console.log('   EXTRACCIÓN TIKTOK - DIRECT HTTP');
    console.log('========================================\n');

    const result = await extractHistoricalDirect(cookies);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
};

// Para prueba local
if (require.main === module) {
  const fs = require('fs');
  const cookies = JSON.parse(fs.readFileSync('./tiktok-cookies.json', 'utf-8'));
  
  extractHistoricalDirect(cookies)
    .then(result => {
      console.log('\n✅ RESULTADO:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
