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
  const validPeriods = [7, 14, 28, 30];
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
      priority_region: "US",
      tz_name: "UTC",
      app_name: "tiktok_creator_center",
      app_language: "en",
      device_platform: "web_pc",
      channel: "tiktok_web",
      device_id: "7586552972738463288",
      os: "win",
      tz_offset: "0",
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

    // Generar fechas para el período solicitado
    // El array viene ordenado cronológicamente: primer elemento = más antiguo
    // end_days: 1 significa que los datos terminan AYER (no incluye hoy)
    const generateDatesWithValues = (values) => {
      // Parsear la fecha de referencia sin conversión de zona horaria
      let lastDate;
      if (referenceDate) {
        // Si es string, parsear en formato YYYY-MM-DD
        if (typeof referenceDate === 'string') {
          const parts = referenceDate.split('-');
          lastDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // Si es objeto Date, clonar y resetear horas
          lastDate = new Date(referenceDate);
          lastDate.setHours(0, 0, 0, 0);
        }
      } else {
        // Usar hoy como referencia
        lastDate = new Date();
        lastDate.setHours(0, 0, 0, 0);
        lastDate.setDate(lastDate.getDate() - 1); // Ayer por defecto
      }
      
      const dateArray = [];
      
      // Filtrar solo valores completados (status === 0), excluyendo datos incompletos de hoy
      const validValues = values.filter(v => v.status === 0);
      
      // Solo tomar los últimos N días solicitados (period)
      const daysToShow = Math.min(validValues.length, daysPeriod);
      const selectedValues = validValues.slice(-daysToShow);
      
      // El array parece estar desplazado un día hacia atrás, así que agregamos 1 día al rango
      let firstDate = new Date(lastDate);
      firstDate.setDate(firstDate.getDate() - (selectedValues.length - 1) + 1); // Ajuste de +1 día
      
      for (let i = 0; i < selectedValues.length; i++) {
        const date = new Date(firstDate);
        date.setDate(date.getDate() + i);
        
        dateArray.push({
          date: date.toISOString().split('T')[0], // Format: YYYY-MM-DD
          value: selectedValues[i].status === 0 ? selectedValues[i].value : null,
          status: selectedValues[i].status
        });
      }
      
      return dateArray;
    };

    // Procesar y estructurar datos
    const historicalData = {
      timestamp: new Date().toISOString(),
      metrics: {
        video_views: {
          total: metricsData.vv_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.vv_history || [])
        },
        profile_views: {
          total: metricsData.pv_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.pv_history || [])
        },
        likes: {
          total: metricsData.like_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.like_history || [])
        },
        comments: {
          total: metricsData.comment_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.comment_history || [])
        },
        shares: {
          total: metricsData.share_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.share_history || [])
        },
        reached_audience: {
          total: metricsData.reached_audience_history?.reduce((sum, item) => {
            return sum + (item.status === 0 ? item.value : 0);
          }, 0) || 0,
          history: generateDatesWithValues(metricsData.reached_audience_history || [])
        },
        followers: {
          current: metricsData.follower_num?.value || 0,
          history: generateDatesWithValues(metricsData.follower_num_history || [])
        }
      }
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
