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

// Función para extraer datos crudos del API
async function extractRawMetrics(cookies, period = 60) {
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
    console.log(`🔍 Extrayendo datos crudos del API... (Período: ${daysPeriod} días)`);

    const typeRequests = [
      { "insigh_type": "vv_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "pv_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "like_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "comment_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "share_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "follower_num_history", "days": daysPeriod, "end_days": 1 },
      { "insigh_type": "reached_audience_history", "days": daysPeriod, "end_days": 1 }
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

    console.log('📡 Solicitando datos crudos...');
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

    console.log('✅ Datos descargados');

    // RETORNAR DATOS CRUDOS EXACTAMENTE COMO TIKTOK LOS DEVUELVE
    const debugOutput = {
      timestamp: new Date().toISOString(),
      period: daysPeriod,
      raw_api_response: {
        status_code: metricsData.status_code,
        status_msg: metricsData.status_msg,
        metrics: {
          vv_history: metricsData.vv_history || [],
          pv_history: metricsData.pv_history || [],
          like_history: metricsData.like_history || [],
          comment_history: metricsData.comment_history || [],
          share_history: metricsData.share_history || [],
          reached_audience_history: metricsData.reached_audience_history || [],
          follower_num_history: metricsData.follower_num_history || []
        }
      },
      analysis: {
        vv_count: (metricsData.vv_history || []).length,
        pv_count: (metricsData.pv_history || []).length,
        expected_count: daysPeriod,
        vv_first_5: (metricsData.vv_history || []).slice(0, 5),
        vv_last_5: (metricsData.vv_history || []).slice(-5),
        vv_all: metricsData.vv_history || []
      }
    };

    await page.close();
    return debugOutput;

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
    const period = req.body?.period || req.query?.period || 60;
    
    const result = await extractRawMetrics(cookies, period);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
