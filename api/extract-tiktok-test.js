const puppeteer = require("puppeteer-core");
const { OpenAI } = require("openai");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parsea cookies de cualquier formato
 */
function parseCookies(cookies, domain = '.tiktok.com') {
  if (!cookies) return [];
  
  if (typeof cookies === 'string') {
    try {
      cookies = JSON.parse(cookies);
    } catch (e) {
      console.error('Error parseando cookies:', e.message);
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
        .map(cookie => {
          const processed = {
            name: String(cookie.name),
            value: String(cookie.value),
            domain: cookie.domain || domain,
            path: cookie.path || '/'
          };
          
          if (cookie.secure !== undefined) processed.secure = Boolean(cookie.secure);
          if (cookie.httpOnly !== undefined) processed.httpOnly = Boolean(cookie.httpOnly);
          if (cookie.expires !== undefined) processed.expires = Number(cookie.expires);
          if (cookie.sameSite) processed.sameSite = String(cookie.sameSite);
          
          return processed;
        });
    }
  } 
  else if (typeof cookies === 'object') {
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

  console.log(`✅ Parseadas ${cookieArray.length} cookies válidas para ${domain}`);
  return cookieArray;
}

/**
 * Extrae métricas simplificadas de TikTok (solo totales, sin histórico)
 * Para mantener la velocidad bajo 10 segundos en n8n
 */
async function extractTikTokDataFast(tiktokCookies, period = 28) {
  if (!tiktokCookies) {
    throw new Error("TikTok cookies requeridas");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const cookieArray = parseCookies(tiktokCookies, '.tiktok.com');
  console.log(`🔐 Configurando ${cookieArray.length} cookies`);
  await page.setCookie(...cookieArray);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D&activeAnalyticsMetric=shares`;
  
  console.log(`📊 Navegando a TikTok Studio (Período: últimos ${period} días)`);
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await sleep(2000);

  // Validar sesión
  const sessionValid = await page.evaluate(() => {
    return !window.location.href.includes('login') && 
           document.querySelectorAll('*').length > 100;
  });

  if (!sessionValid) {
    throw new Error("Sesión no válida - cookies pueden estar expiradas");
  }

  console.log("✅ Sesión válida\n");

  // Extraer TODOS los números visibles (esto será rápido)
  const allNumbers = await page.evaluate(() => {
    const numbers = [];
    
    // Buscar todos los elementos con números
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent?.trim();
      if (text && /^[\d,]+$/.test(text) && !el.querySelector('*')) {
        // Es un elemento con solo números
        const numStr = text.replace(/,/g, '');
        const num = parseInt(numStr);
        if (!isNaN(num) && num > 0) {
          numbers.push(num);
        }
      }
    });
    
    // Remover duplicados y ordenar descendente
    return [...new Set(numbers)].sort((a, b) => b - a);
  });

  console.log(`📈 Números encontrados en página: ${allNumbers.slice(0, 10).join(', ')}`);

  // Estadísticas simples (sin Vision, sin histórico)
  const metricsData = {
    visualizaciones_videos: {
      totalValue: String(allNumbers[0] || 0),
      historicalData: [],
      totalPoints: 0,
      description: "Número más alto encontrado"
    },
    visualizaciones_perfil: {
      totalValue: String(allNumbers[1] || 0),
      historicalData: [],
      totalPoints: 0,
      description: "Segundo número más alto"
    },
    me_gusta: {
      totalValue: String(allNumbers[2] || 0),
      historicalData: [],
      totalPoints: 0
    },
    comentarios: {
      totalValue: String(allNumbers[3] || 0),
      historicalData: [],
      totalPoints: 0
    },
    veces_compartido: {
      totalValue: String(allNumbers[4] || 0),
      historicalData: [],
      totalPoints: 0
    }
  };

  await browser.close();
  
  return metricsData;
}

// Vercel serverless handler
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tiktokCookies, period = 'LAST_28D' } = req.body;

    if (!tiktokCookies) {
      return res.status(400).json({ 
        error: 'tiktokCookies requeridas',
        received: Object.keys(req.body)
      });
    }

    const periodMap = {
      'LAST_7D': 7,
      'LAST_28D': 28,
      'LAST_90D': 90,
      'THIS_MONTH': 28,
      'LAST_MONTH': 28
    };

    const tiktokPeriod = periodMap[period] || 28;

    console.log('\n========================================');
    console.log('   EXTRACCIÓN TIKTOK (FAST MODE)');
    console.log('========================================\n');

    const tiktokData = await extractTikTokDataFast(tiktokCookies, tiktokPeriod);

    const results = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        period: period,
        platform: 'TikTok',
        mode: 'fast',
        metrics: tiktokData
      }
    };

    console.log('✅ Extracción completada\n');

    return res.status(200).json(results);
  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ 
      error: error.message,
      success: false,
      hint: 'Las cookies pueden estar expiradas. Por favor, genera nuevas cookies desde TikTok Studio.'
    });
  }
};
