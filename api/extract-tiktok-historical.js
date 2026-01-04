const puppeteer = require("puppeteer-core");

// Token de Browserless
const TOKEN = process.env.BROWSERLESS_TOKEN || "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

// Función para parsear cookies en cualquier formato
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

// Función para extraer histórico desde API directa
async function extractHistorical(cookies, referenceDate = null, period = 28) {
  // Validar periodo válido
  const validPeriods = [7, 14, 28, 30, 60];
  if (!validPeriods.includes(Number(period))) {
    throw new Error(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
  }
  
  const daysPeriod = Number(period);
  
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
    console.log(`🔍 Conectando a API de TikTok... (Período: últimos ${daysPeriod} días)`);

    // Construir parámetros para el request usando el periodo especificado
    const typeRequests = [
      { "insigh_type": "vv_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "pv_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "like_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "comment_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "share_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "follower_num_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "reached_audience_history", "days": daysPeriod, "end_days": 1 }
    ];

    // Construir URL del endpoint
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

    // Navegar al endpoint
    console.log('📡 Solicitando datos históricos...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // Obtener el JSON
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

    console.log('✅ Datos descargados correctamente');

    // ✅ TRANSFORMACIÓN COMPLETA EN EL BACKEND
    // Función para procesar cada métrica
    function processMetric(rawArray) {
      if (!rawArray || rawArray.length === 0) return [];
      
      // Filtrar solo elementos completados (status === 0)
      // LOS DATOS YA VIENEN EN ORDEN CORRECTO: oldest → newest
      const completedValues = rawArray
        .filter(item => item && item.status === 0)
        .map(item => item.value || 0);
      
      return completedValues;
    }

    // Obtener ayer en México (UTC-6)
    const now = new Date();
    const mexicoDate = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    const yesterday = new Date(mexicoDate);
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    // El API retorna datos sin el primer día del período
    // Ejemplo: periodo 60 días = datos de los últimos 59 días + hoy (incomplete)
    // Entonces necesitamos agregar 1 día más al inicio
    const firstDate = new Date(yesterday);
    firstDate.setDate(firstDate.getDate() - daysPeriod);

    // Generar array de fechas
    const dates = [];
    for (let i = 0; i < daysPeriod; i++) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Procesar todas las métricas
    const processedMetrics = {
      video_views: processMetric(metricsData.vv_history || []),
      profile_views: processMetric(metricsData.pv_history || []),
      likes: processMetric(metricsData.like_history || []),
      comments: processMetric(metricsData.comment_history || []),
      shares: processMetric(metricsData.share_history || []),
      reached_audience: processMetric(metricsData.reached_audience_history || []),
      followers: processMetric(metricsData.follower_num_history || [])
    };

    // Crear estructura de salida con fechas mapeadas
    // Si hay menos valores que fechas, agregar 0 al inicio (para el primer día)
    const metrics = {};
    Object.keys(processedMetrics).forEach(metricName => {
      let values = processedMetrics[metricName];
      
      // Si faltan valores (caso típico: 59 valores para 60 fechas)
      // agregar 0 al inicio
      if (values.length < daysPeriod) {
        values = [0, ...values];
      }
      
      const history = dates.map((date, i) => ({
        date: date,
        value: values[i] || 0
      }));
      
      metrics[metricName] = {
        total: values.reduce((a, b) => a + (b || 0), 0),
        history: history
      };
    });

    // Retornar datos ya transformados
    const historicalData = {
      timestamp: new Date().toISOString(),
      period: daysPeriod,
      query_date: yesterday.toISOString().split('T')[0],
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
  try {
    const cookiesInput = req.body?.cookies || req.query?.cookies;
    
    if (!cookiesInput) {
      return res.status(400).json({
        error: "Missing cookies parameter",
        message: "Please provide cookies in request body or query parameter"
      });
    }

    const cookies = typeof cookiesInput === 'string' ? JSON.parse(cookiesInput) : cookiesInput;
    
    // Permitir que el usuario envíe la fecha de referencia (último día incluido)
    // Si no la envía, usamos ayer
    let referenceDate = req.body?.referenceDate || req.query?.referenceDate;
    if (referenceDate) {
      referenceDate = new Date(referenceDate);
    } else {
      referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - 1); // Ayer por defecto
    }
    
    // Obtener el período del request (7, 14, 28, 30 días)
    const period = req.body.period || 28;
    
    const result = await extractHistorical(cookies, referenceDate, period);
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
  const cookies = JSON.parse(fs.readFileSync('./tiktok-cookies-new.json', 'utf-8'));
  
  extractHistorical(cookies, null, 28)
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
