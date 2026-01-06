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
async function extractHistorical(cookies, referenceDate = null, period = 'last_month') {
  // Determinar período en días
  let daysPeriod;
  let useLastMonth = true;
  
  // Si se proporciona un período específico, usarlo
  if (period && period !== 'last_month') {
    const validPeriods = [7, 14, 28, 30, 60];
    if (!validPeriods.includes(Number(period))) {
      throw new Error(`Invalid period. Must be 'last_month' or one of: ${validPeriods.join(', ')}`);
    }
    daysPeriod = Number(period);
    useLastMonth = false;
  } else {
    // Por defecto: último mes completo
    useLastMonth = true;
  }
  
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
    console.log(`🔍 Conectando a API de TikTok... (Período solicitado: ${daysPeriod} días)`);

    // El API de TikTok retorna (period - 1) valores completos
    // Para obtener 'period' días de datos reales, pedimos 'period + 1' al API
    const apiPeriod = daysPeriod + 1;

    // Construir parámetros para el request
    const typeRequests = [
      { "insigh_type": "vv_history", "days": apiPeriod, "end_days": 1 },
      { "insigh_type": "pv_history", "days": apiPeriod, "end_days": 1 },
      { "insigh_type": "like_history", "days": apiPeriod, "end_days": 1 },
      { "insigh_type": "comment_history", "days": apiPeriod, "end_days": 1 },
      { "insigh_type": "share_history", "days": apiPeriod, "end_days": 1 }
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

    // ✅ TRANSFORMACIÓN COMPLETA EN EL BACKEND
    // Función para procesar cada métrica
    function processMetric(rawArray) {
      if (!rawArray || rawArray.length === 0) return [];
      
      // Filtrar solo elementos completados (status === 0)
      const allCompleted = rawArray
        .filter(item => item && item.status === 0)
        .map(item => item.value || 0);
      
      // Si tenemos más de daysPeriod valores, tomar solo los últimos daysPeriod
      const completedValues = allCompleted.slice(-daysPeriod);
      
      return completedValues;
    }

    // Calcular período
    let firstDate, lastDate;
    
    if (useLastMonth) {
      // Obtener mes anterior completo
      const now = new Date();
      
      // Primer día del mes actual
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Último día del mes anterior = un día antes del primer día de este mes
      lastDate = new Date(firstOfThisMonth);
      lastDate.setDate(lastDate.getDate() - 1);
      
      // Primer día del mes anterior
      firstDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
      
      // Calcular días en el mes anterior
      daysPeriod = lastDate.getDate();
    } else {
      // Obtener ayer en México (UTC-6)
      const now = new Date();
      const mexicoDate = new Date(now.getTime() - (6 * 60 * 60 * 1000));
      const yesterday = new Date(mexicoDate);
      yesterday.setHours(0, 0, 0, 0);
      yesterday.setDate(yesterday.getDate() - 1);

      // Calcular fecha inicial (ayer - (periodo - 1) días)
      lastDate = new Date(yesterday);
      firstDate = new Date(yesterday);
      firstDate.setDate(firstDate.getDate() - (daysPeriod - 1));
    }

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
      shares: processMetric(metricsData.share_history || [])
    };

    // Crear estructura de salida con fechas mapeadas
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

    // Retornar datos ya transformados
    // Información del período
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const firstDateFormatted = formatDate(firstDate);
    const lastDateFormatted = formatDate(lastDate);
    
    // Descripción legible del período
    let periodDescription;
    if (useLastMonth) {
      const monthName = lastDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' });
      periodDescription = `Mes anterior (${monthName})`;
    } else {
      periodDescription = `Últimos ${daysPeriod} días (sin incluir hoy)`;
    }

    const historicalData = {
      timestamp: new Date().toISOString(),
      period: daysPeriod,
      periodDescription: periodDescription,
      dateRange: {
        from: firstDateFormatted,
        to: lastDateFormatted,
        totalDays: daysPeriod
      },
      query_date: lastDate.toISOString().split('T')[0],
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
    
    // Obtener el período del request
    // Por defecto: 'last_month' (mes anterior completo)
    // Alternativa: número de días (7, 14, 28, 30, 60)
    const period = req.body.period || req.query.period || 'last_month';
    
    // Guardar cookies originales para análisis de expiración
    const originalCookies = Array.isArray(cookies) ? cookies : [];
    
    const result = await extractHistorical(cookies, null, period);
    
    // Agregar análisis de expiración de cookies al resultado
    const now = new Date();
    const nowTimestamp = now.getTime() / 1000;

    const cookieExpirationAnalysis = {
      analysisTimestamp: now.toISOString(),
      totalCookies: originalCookies.length,
      soonestExpiring: null,
      expiredCookies: [],
      expiringInWeek: [],
      allCookies: []
    };

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
      const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

      const cookieInfo = {
        name: cookie.name,
        domain: cookie.domain,
        expirationDate: expDate.toISOString(),
        expirationDateFormatted: expDate.toLocaleString('es-MX'),
        daysUntilExpiry: parseFloat(daysUntilExpiry.toFixed(2)),
        status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'VALID'
      };

      cookieExpirationAnalysis.allCookies.push(cookieInfo);

      if (isExpired) {
        cookieExpirationAnalysis.expiredCookies.push({
          name: cookie.name,
          domain: cookie.domain,
          expiredDate: expDate.toLocaleString('es-MX'),
          daysOverdue: parseFloat(Math.abs(daysUntilExpiry).toFixed(2))
        });
      }

      if (isExpiringSoon) {
        cookieExpirationAnalysis.expiringInWeek.push({
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: expDate.toLocaleString('es-MX'),
          daysRemaining: parseFloat(daysUntilExpiry.toFixed(2))
        });
      }

      if (!isExpired && (!cookieExpirationAnalysis.soonestExpiring || expDate < new Date(cookieExpirationAnalysis.soonestExpiring.expirationDate))) {
        cookieExpirationAnalysis.soonestExpiring = {
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: expDate.toLocaleString('es-MX'),
          daysUntilExpiry: parseFloat(daysUntilExpiry.toFixed(2))
        };
      }
    });

    cookieExpirationAnalysis.allCookies.sort((a, b) => {
      if (a.status === 'SESSION') return 1;
      if (b.status === 'SESSION') return -1;
      const dateA = a.expirationDate === 'Never (session cookie)' ? Infinity : new Date(a.expirationDate);
      const dateB = b.expirationDate === 'Never (session cookie)' ? Infinity : new Date(b.expirationDate);
      return dateA - dateB;
    });

    result.cookies = cookieExpirationAnalysis;
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
