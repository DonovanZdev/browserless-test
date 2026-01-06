const puppeteer = require("puppeteer-core");

const TOKEN = process.env.BROWSERLESS_TOKEN || "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

function parseCookies(cookies, domain = '.tiktok.com') {
  if (!cookies) return [];
  
  if (typeof cookies === 'string') {
    try {
      let cookieString = cookies.trim();
      if ((cookieString.startsWith('"') && cookieString.endsWith('"')) ||
          (cookieString.startsWith("'") && cookieString.endsWith("'"))) {
        cookieString = cookieString.slice(1, -1);
      }
      cookies = JSON.parse(cookieString);
    } catch (e) {
      return [];
    }
  }

  let cookieArray = [];
  
  if (Array.isArray(cookies)) {
    if (cookies.length === 1 && typeof cookies[0] === 'object' && !cookies[0].name) {
      const cookieObj = cookies[0];
      cookieArray = Object.entries(cookieObj)
        .filter(([name, value]) => name && value)
        .map(([name, value]) => ({
          name: String(name),
          value: String(value),
          domain,
          path: '/',
          secure: true,
          httpOnly: true
        }));
    } else {
      cookieArray = cookies
        .filter(cookie => cookie && cookie.name && cookie.value)
        .map(cookie => ({
          name: String(cookie.name),
          value: String(cookie.value),
          domain: cookie.domain || domain,
          path: cookie.path || '/',
          secure: Boolean(cookie.secure !== false),
          httpOnly: Boolean(cookie.httpOnly !== false)
        }));
    }
  } else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies)
      .filter(([name, value]) => name && value)
      .map(([name, value]) => ({
        name: String(name),
        value: String(value),
        domain,
        path: '/',
        secure: true,
        httpOnly: true
      }));
  }
  
  return cookieArray;
}

async function extractHistoricalByDate(cookies) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const cookieArray = parseCookies(cookies, '.tiktok.com');
    
    if (cookieArray.length === 0) {
      throw new Error('No valid cookies provided');
    }

    await page.setCookie(...cookieArray);

    console.log('🔐 Cookies configuradas');
    console.log(`🔍 Conectando a API de TikTok con parámetros de fecha específica...\n`);

    // Obtener mes anterior completo
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPrevMonth = new Date(firstOfThisMonth);
    lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 1);
    const firstDayOfPrevMonth = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), 1);

    const daysPeriod = lastDayOfPrevMonth.getDate();
    
    console.log(`📅 Extrayendo: ${firstDayOfPrevMonth.toLocaleDateString('es-MX')} a ${lastDayOfPrevMonth.toLocaleDateString('es-MX')} (${daysPeriod} días)\n`);

    // ⚠️ ESTRATEGIA: Usar query_date con fecha específica en lugar de "días atrás"
    // TikTok puede aceptar un parámetro de fecha específica
    
    // Convertir fechas a timestamp
    const queryDate = Math.floor(lastDayOfPrevMonth.getTime() / 1000); // último día del mes anterior
    
    const typeRequests = [
      { "insigh_type": "vv_history", "days": daysPeriod, "end_days": 0 },
      { "insigh_type": "pv_history", "days": daysPeriod, "end_days": 0 },
      { "insigh_type": "like_history", "days": daysPeriod, "end_days": 0 },
      { "insigh_type": "comment_history", "days": daysPeriod, "end_days": 0 },
      { "insigh_type": "share_history", "days": daysPeriod, "end_days": 0 }
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

    console.log('📡 Solicitando datos históricos...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    const metricsData = await page.evaluate(() => {
      try {
        return JSON.parse(document.body.innerText);
      } catch (e) {
        return null;
      }
    });

    if (!metricsData || metricsData.status_code !== 0) {
      throw new Error(`API error: ${metricsData?.status_msg || 'Unknown error'}`);
    }

    // ✅ Procesar sin slice - confiar en que el API retorna exactamente lo que pedimos
    function processMetric(rawArray, metricName) {
      if (!rawArray || rawArray.length === 0) return [];
      
      const allCompleted = rawArray
        .filter(item => item && item.status === 0)
        .map(item => item.value || 0);
      
      // NO hacer slice - tomar directamente todos los datos
      console.log(`  ├─ ${metricName}: recibidos=${allCompleted.length}`);
      
      return allCompleted;
    }

    console.log('\n📊 Procesando métricas:');
    const processedMetrics = {
      video_views: processMetric(metricsData.vv_history || [], 'video_views'),
      profile_views: processMetric(metricsData.pv_history || [], 'profile_views'),
      likes: processMetric(metricsData.like_history || [], 'likes'),
      comments: processMetric(metricsData.comment_history || [], 'comments'),
      shares: processMetric(metricsData.share_history || [], 'shares')
    };

    // Generar fechas
    const dates = [];
    for (let i = 0; i < daysPeriod; i++) {
      const date = new Date(firstDayOfPrevMonth);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Crear estructura de salida
    const metrics = {};
    Object.keys(processedMetrics).forEach(metricName => {
      const values = processedMetrics[metricName];
      const history = dates.map((date, i) => ({
        date: date,
        value: values[i] || 0
      }));
      
      metrics[metricName] = {
        total: values.reduce((a, b) => a + (b || 0), 0),
        history: history
      };
    });

    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const historicalData = {
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

    await page.close();
    return historicalData;

  } finally {
    await browser.disconnect();
  }
}

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
    
    const result = await extractHistoricalByDate(cookies);
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
  
  extractHistoricalByDate(cookies)
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
