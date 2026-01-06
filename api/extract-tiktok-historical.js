const puppeteer = require("puppeteer-core");

// Token de Browserless
const TOKEN = process.env.BROWSERLESS_TOKEN || "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

// Función para parsear cookies
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

// Función para extraer histórico del mes anterior completo
async function extractHistorical(cookies) {
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

    // Calcular primer y último día del mes anterior
    const now = new Date();
    
    // Primer día del mes actual
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Último día del mes anterior
    const lastDayOfPrevMonth = new Date(firstOfThisMonth);
    lastDayOfPrevMonth.setDate(lastDayOfPrevMonth.getDate() - 1);
    
    // Primer día del mes anterior
    const firstDayOfPrevMonth = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), 1);

    const daysInMonth = lastDayOfPrevMonth.getDate();
    
    console.log(`📅 Extrayendo datos del mes: ${firstDayOfPrevMonth.toLocaleDateString('es-MX')} a ${lastDayOfPrevMonth.toLocaleDateString('es-MX')} (${daysInMonth} días)`);

    // Convertir a timestamps Unix en milisegundos (UTC)
    const startTimestamp = firstDayOfPrevMonth.getTime();
    const endTimestamp = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), lastDayOfPrevMonth.getDate(), 23, 59, 59).getTime();

    // Formato de fechas para UTCDateRange
    const formatDateForUTC = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    const fromDate = formatDateForUTC(firstDayOfPrevMonth);
    const toDate = formatDateForUTC(lastDayOfPrevMonth);

    // Construir el parámetro dateRange como lo espera TikTok
    const dateRange = {
      type: 'custom',
      dateRange: {
        start: startTimestamp,
        end: endTimestamp
      },
      UTCDateRange: {
        from: `${fromDate} 00:00:00`,
        to: `${toDate} 00:00:00`
      }
    };

    const dateRangeEncoded = encodeURIComponent(JSON.stringify(dateRange));

    // Construir URL de TikTok Studio CON parámetros dinámicos según el mes
    const studioUrl = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=${dateRangeEncoded}`;

    console.log(`🌐 Navegando a TikTok Studio...`);
    await page.goto(studioUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // Esperar a que cargue la página
    await page.waitForTimeout(2000);

    // Hacer request al API interno con período dinámico
    console.log('📡 Extrayendo datos de analíticas...');

    const typeRequests = [
      { "insigh_type": "vv_history", "days": daysInMonth + 1, "end_days": 1 },
      { "insigh_type": "pv_history", "days": daysInMonth + 1, "end_days": 1 },
      { "insigh_type": "like_history", "days": daysInMonth + 1, "end_days": 1 },
      { "insigh_type": "comment_history", "days": daysInMonth + 1, "end_days": 1 },
      { "insigh_type": "share_history", "days": daysInMonth + 1, "end_days": 1 }
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

    const apiUrl = `${baseUrl}?${params.toString()}`;
    await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 15000 });

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

    // Procesar métricas
    function processMetric(rawArray) {
      if (!rawArray || rawArray.length === 0) return [];
      
      const allCompleted = rawArray
        .filter(item => item && item.status === 0)
        .map(item => item.value || 0);
      
      // Tomar solo los últimos daysInMonth valores
      if (allCompleted.length > daysInMonth) {
        return allCompleted.slice(-daysInMonth);
      }
      
      return allCompleted;
    }

    const processedMetrics = {
      video_views: processMetric(metricsData.vv_history || []),
      profile_views: processMetric(metricsData.pv_history || []),
      likes: processMetric(metricsData.like_history || []),
      comments: processMetric(metricsData.comment_history || []),
      shares: processMetric(metricsData.share_history || [])
    };

    // Generar array de fechas del mes anterior
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(lastDayOfPrevMonth.getFullYear(), lastDayOfPrevMonth.getMonth(), i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Mapear métricas con fechas
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

    // Información del período
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const monthName = lastDayOfPrevMonth.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

    const historicalData = {
      timestamp: new Date().toISOString(),
      period: daysInMonth,
      periodDescription: `Mes anterior (${monthName})`,
      dateRange: {
        from: formatDate(firstDayOfPrevMonth),
        to: formatDate(lastDayOfPrevMonth),
        totalDays: daysInMonth
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

// Exportar para serverless
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const cookiesInput = req.body?.tiktokCookies || req.query?.tiktokCookies;
    
    if (!cookiesInput) {
      return res.status(400).json({
        error: "Missing tiktokCookies parameter",
        message: "Please provide tiktokCookies in request body"
      });
    }

    const cookies = typeof cookiesInput === 'string' ? JSON.parse(cookiesInput) : cookiesInput;
    
    console.log('\n========================================');
    console.log('   EXTRACCIÓN TIKTOK HISTÓRICO');
    console.log('   (Último mes completo)');
    console.log('========================================\n');

    const result = await extractHistorical(cookies);

    // Agregar análisis de expiración de cookies
    const now = new Date();
    const nowTimestamp = now.getTime() / 1000;

    const cookieExpirationAnalysis = {
      analysisTimestamp: now.toISOString(),
      totalCookies: Array.isArray(cookies) ? cookies.length : 0,
      soonestExpiring: null,
      expiredCookies: [],
      expiringInWeek: [],
      allCookies: []
    };

    const originalCookies = Array.isArray(cookies) ? cookies : [];
    originalCookies.forEach(cookie => {
      if (!cookie.expirationDate) {
        cookieExpirationAnalysis.allCookies.push({
          name: cookie.name,
          domain: cookie.domain,
          status: 'SESSION',
          expirationDate: 'Never (session cookie)'
        });
        return;
      }

      const expTimestamp = cookie.expirationDate;
      const secondsUntilExpiry = expTimestamp - nowTimestamp;
      const daysUntilExpiry = secondsUntilExpiry / (60 * 60 * 24);
      const expDate = new Date(expTimestamp * 1000);
      const isExpired = secondsUntilExpiry <= 0;

      const formattedDate = expDate.toLocaleString('es-MX');

      if (isExpired) {
        cookieExpirationAnalysis.expiredCookies.push({
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysUntilExpiry: 0,
          status: 'EXPIRED'
        });
      } else if (daysUntilExpiry < 7) {
        cookieExpirationAnalysis.expiringInWeek.push({
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysUntilExpiry: parseFloat(daysUntilExpiry.toFixed(2)),
          status: 'EXPIRING_SOON'
        });
      }

      if (!cookieExpirationAnalysis.soonestExpiring || secondsUntilExpiry < (cookieExpirationAnalysis.soonestExpiring.expirationTimestamp - nowTimestamp)) {
        cookieExpirationAnalysis.soonestExpiring = {
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysUntilExpiry: parseFloat(daysUntilExpiry.toFixed(2)),
          expirationTimestamp: expTimestamp
        };
      }

      cookieExpirationAnalysis.allCookies.push({
        name: cookie.name,
        domain: cookie.domain,
        expirationDate: formattedDate,
        expirationDateFormatted: expDate.toLocaleString('es-MX', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        daysUntilExpiry: parseFloat(daysUntilExpiry.toFixed(2)),
        status: 'VALID'
      });
    });

    result.cookies = cookieExpirationAnalysis;

    console.log('✅ Extracción completada\n');

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ 
      error: error.message,
      success: false,
      hint: 'Las cookies pueden estar expiradas o TikTok requiere re-autenticación.'
    });
  }
};
