const puppeteer = require("puppeteer-core");
const { OpenAI } = require("openai");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parsea cookies de cualquier formato (string JSON, objeto, array)
 * Soporta dos formatos principales:
 * 1. Array de objetos: [{name: "x", value: "y"}, ...]
 * 2. Objeto plano con propiedades: {"cookieName": "value", ...}
 * 3. Array con objeto plano: [{"cookieName": "value", ...}]
 * 4. String JSON (escapado o no)
 */
function parseCookies(cookies, domain = '.tiktok.com') {
  if (!cookies) return [];
  
  if (typeof cookies === 'string') {
    try {
      // Si está doble-escapado, remover comillas externas
      let cookieString = cookies.trim();
      if ((cookieString.startsWith('"') && cookieString.endsWith('"')) ||
          (cookieString.startsWith("'") && cookieString.endsWith("'"))) {
        cookieString = cookieString.slice(1, -1);
      }
      
      cookies = JSON.parse(cookieString);
    } catch (e) {
      console.error('Error parseando cookies string:', e.message);
      console.error('Recibido:', cookies.slice(0, 200));
      return [];
    }
  }

  let cookieArray = [];
  
  if (Array.isArray(cookies)) {
    // Si el array contiene un único objeto con propiedades (formato antiguo)
    if (cookies.length === 1 && typeof cookies[0] === 'object' && !cookies[0].name) {
      // Convertir objeto plano a array de cookies
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
      // Array normal de cookies [{name, value}, ...]
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

  console.log(`✅ Parseados ${cookieArray.length} cookies válidos para ${domain}`);
  return cookieArray;
}

/**
 * Extrae una métrica individual de TikTok
 * Estrategia: Hacer click en la tarjeta de métrica para seleccionarla,
 * luego extraer los datos del gráfico mostrado
 */
async function extractTikTokMetric(page, metricConfig, period, metricsData, metricIndex) {
  try {
    console.log(`\n📍 Extrayendo: ${metricConfig.name} (índice: ${metricIndex})`);
    
    // PASO 1: Encontrar y hacer click en la tarjeta de la métrica
    // Usar page.$eval para encontrar el elemento y hacer click
    try {
      await page.evaluate((label) => {
        // Buscar el elemento que contiene el label
        const elements = Array.from(document.querySelectorAll('*'))
          .filter(el => el.textContent.includes(label));
        
        if (elements.length > 0) {
          // Tomar el más pequeño (más específico)
          const target = elements.reduce((a, b) => 
            a.textContent.length < b.textContent.length ? a : b
          );
          // Hacer click usando Puppeteer desde el contexto del browser
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.click();
        }
      }, metricConfig.label);
      
      console.log(`  ✅ Click ejecutado en tarjeta`);
      await sleep(1000); // Esperar más tiempo para la actualización
    } catch (e) {
      console.log(`  ⚠️  Error al hacer click: ${e.message}`);
    }

    // PASO 2: Extraer el total desde el DOM
    const domData = await page.evaluate((label) => {
      const result = { totalValue: 0 };
      
      // Buscar todos los números en la página
      const numberTexts = [];
      document.querySelectorAll('*').forEach(el => {
        const text = el.innerText?.trim();
        if (text && /^\d+$/.test(text)) {
          const num = parseInt(text);
          if (num > 0) numberTexts.push(num);
        }
      });
      
      // El más grande es probablemente el total
      if (numberTexts.length > 0) {
        result.totalValue = Math.max(...numberTexts);
      }
      
      return result;
    }, metricConfig.label);

    console.log(`  📊 Total desde DOM: ${domData.totalValue}`);

    // PASO 3: Capturar screenshot y usar Vision
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    const prompt = `Extrae los valores exactos del gráfico de TikTok Studio.

Número mostrado: ${domData.totalValue}
Período: ${period} días

Instrucciones:
- Lee de IZQUIERDA a DERECHA
- Extrae exactamente ${period} valores (usa 0 si está vacío)
- Cada número = 1 día
- SUMA total = ${domData.totalValue}

RESPONDE SOLO CON ARRAY JSON, NADA MÁS:
[1, 2, 3, 4, ...]`;
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${screenshot}` },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 250,
      });

      const content = response.choices[0].message.content.trim();
      const arrayMatch = content.match(/\[\s*[\d\s,]*\]/);
      
      if (!arrayMatch) {
        console.log(`  ⚠️  Vision no devolvió array válido`);
        throw new Error('No array found');
      }
      
      let extractedArray = JSON.parse(arrayMatch[0]);
      const sum = extractedArray.reduce((a, b) => a + b, 0);
      
      console.log(`  ✅ Vision: ${extractedArray.length} puntos, suma: ${sum}`);
      
      // Construir histórico
      const historyArray = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < extractedArray.length; i++) {
        const daysAgo = extractedArray.length - 1 - i;
        const date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        
        if (date > today) continue;
        
        const dayNum = date.getDate();
        const monthNum = date.getMonth();
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        
        historyArray.push({
          fecha: `${dayNum} de ${months[monthNum]}`,
          valor: extractedArray[i].toString(),
          timestamp: Math.floor(date.getTime() / 1000),
          date: date.toISOString().split('T')[0]
        });
      }

      metricsData[metricConfig.name] = {
        totalValue: sum.toString(),
        historicalData: historyArray,
        totalPoints: historyArray.length
      };

      console.log(`  ✅ ${metricConfig.name}: ${historyArray.length} días | Total: ${sum}`);
      
    } catch (visionError) {
      console.error(`  ❌ Error en Vision:`, visionError.message);
      metricsData[metricConfig.name] = {
        totalValue: '0',
        historicalData: [],
        totalPoints: 0
      };
    }
  } catch (e) {
    console.error(`  ❌ Error ${metricConfig.name}:`, e.message);
    metricsData[metricConfig.name] = {
      totalValue: '0',
      historicalData: [],
      totalPoints: 0
    };
  }
}

/**
 * Extrae métricas históricas de TikTok
 */
async function extractTikTokDataHistorical(tiktokCookies, period = 28) {
  if (!tiktokCookies) {
    throw new Error("TikTok cookies requeridas");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const cookieArray = parseCookies(tiktokCookies, '.tiktok.com');
  console.log(`🔐 Configurando ${cookieArray.length} cookies para .tiktok.com`);
  await page.setCookie(...cookieArray);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D&activeAnalyticsMetric=shares`;
  
  console.log(`📊 Navegando a TikTok Studio (Período: últimos ${period} días)...`);
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await sleep(3000);

  // Verificar si la sesión es válida chequeando si se cargó contenido
  const sessionValid = await page.evaluate(() => {
    // Buscar elementos que indiquen que hay datos cargados
    const hasContent = document.querySelector('[role="main"]') !== null;
    const hasMetrics = document.querySelectorAll('div').length > 50;
    return hasContent && hasMetrics;
  });

  console.log(`🔍 Validación de sesión: ${sessionValid ? '✅ VÁLIDA' : '❌ INVÁLIDA - Posibles cookies expiradas'}`);

  if (!sessionValid) {
    console.error('⚠️  TikTok Studio no cargó contenido. Las cookies pueden estar expiradas.');
  }

  const metricsData = {};
  
  const metrics = [
    { name: 'visualizaciones_videos', label: 'Visualizaciones de videos' },
    { name: 'visualizaciones_perfil', label: 'Visualizaciones de perfil' },
    { name: 'me_gusta', label: 'Me gusta' },
    { name: 'comentarios', label: 'Comentarios' },
    { name: 'veces_compartido', label: 'Veces compartido' }
  ];

  console.log('📈 Extrayendo valores históricos de cada métrica...\n');

  // Procesar métricas en paralelo (máximo 2 simultáneamente)
  const batchSize = 2;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    
    await Promise.all(batch.map((metricConfig, batchIdx) => extractTikTokMetric(page, metricConfig, period, metricsData, i + batchIdx)));
  }

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

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;
    let { tiktokCookies, period = 'LAST_28D' } = rawBody;

    if (!tiktokCookies) {
      return res.status(400).json({ 
        error: 'tiktokCookies requeridas',
        received: Object.keys(rawBody)
      });
    }

    // Normalizar período a número de días
    const periodMap = {
      'LAST_7D': 7,
      'LAST_28D': 28,
      'LAST_90D': 90,
      'THIS_MONTH': 28,
      'LAST_MONTH': 28
    };

    const tiktokPeriod = periodMap[period] || 28;

    console.log('\n========================================');
    console.log('   EXTRACCIÓN TIKTOK');
    console.log('========================================\n');

    // Extraer TikTok
    const tiktokData = await extractTikTokDataHistorical(tiktokCookies, tiktokPeriod);

    const results = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        period: period,
        platform: 'TikTok',
        metrics: tiktokData
      }
    };

    console.log('✅ Extracción completada\n');

    return res.status(200).json(results);
  } catch (error) {
    console.error('❌ Error extrayendo TikTok:', error.message);
    return res.status(500).json({ 
      error: error.message,
      success: false,
      hint: 'Las cookies podrían estar expiradas. Por favor, genera nuevas cookies desde TikTok Studio.'
    });
  }
};
