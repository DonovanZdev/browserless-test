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
    const clickSuccess = await page.evaluate((label, index) => {
      // Buscar todas las tarjetas de métrica (divs con clases de contenedor)
      const metricCards = Array.from(document.querySelectorAll('div, section, article'))
        .filter(el => {
          const text = el.textContent?.trim() || '';
          return text.includes(label);
        });
      
      if (metricCards.length === 0) {
        console.log(`  [DOM] No se encontró tarjeta para: ${label}`);
        return { success: false, clickedCardText: '' };
      }
      
      // Tomar la tarjeta más específica (la más pequeña con el label)
      const specificCard = metricCards.reduce((smallest, current) => 
        current.textContent.length < smallest.textContent.length ? current : smallest
      );
      
      // Simular click
      specificCard.click();
      
      return {
        success: true,
        clickedCardText: specificCard.textContent.slice(0, 50),
        cardSize: specificCard.textContent.length
      };
    }, metricConfig.label, metricIndex);

    if (clickSuccess.success) {
      console.log(`  ✅ Click en tarjeta: ${clickSuccess.clickedCardText}...`);
      // Esperar a que se actualice el gráfico
      await sleep(500);
    } else {
      console.log(`  ⚠️  No se pudo hacer click en tarjeta`);
    }

    // PASO 2: Extraer los datos del gráfico mostrado
    let historicalData = await page.evaluate(() => {
      const result = {
        dailyValues: [],
        totalValue: null
      };

      // Buscar el número grande (total) en la tarjeta seleccionada
      const allNumbers = [];
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim();
        if (text && /^[\d,]+$/.test(text)) {
          const num = parseInt(text.replace(/,/g, ''));
          if (!isNaN(num) && num > 0) {
            allNumbers.push(num);
          }
        }
      });
      
      if (allNumbers.length > 0) {
        result.totalValue = Math.max(...allNumbers);
      }

      // Buscar datos del gráfico usando Vision es más confiable
      // Aquí solo intentamos con estructura del DOM como fallback
      const circles = document.querySelectorAll('circle, [role*="graphics"]');
      if (circles.length > 10) {
        // Probablemente hay un gráfico
        result.dailyValues = Array(28).fill(1); // Placeholder
      }

      return result;
    });

    // PASO 3: Usar Vision para extraer valores del gráfico (más confiable)
    console.log(`  📸 Capturando screenshot para análisis con Vision...`);
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    const totalFromDOM = historicalData.totalValue;
    const prompt = `Extrae los ${period} valores del gráfico de TikTok Studio.

Instrucciones:
1. El número GRANDE mostrado es el TOTAL: ${totalFromDOM}
2. Lee el gráfico de IZQUIERDA a DERECHA (día antiguo → reciente)
3. Extrae EXACTAMENTE ${period} valores (o menos si hay vacíos)
4. Cada punto/barra = 1 día

RESPONDE SOLO CON ARRAY JSON:
[num, num, num, ...]

La suma DEBE ser ${totalFromDOM}`;
    
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
        max_tokens: 300,
      });

      const content = response.choices[0].message.content.trim();
      const arrayMatch = content.match(/\[\s*[\d\s,]*\]/);
      
      if (arrayMatch) {
        const extractedArray = JSON.parse(arrayMatch[0]);
        const sum = extractedArray.reduce((a, b) => a + b, 0);
        console.log(`  ✅ Vision: ${extractedArray.length} puntos, suma: ${sum}`);
        historicalData.dailyValues = extractedArray;
      } else {
        console.log(`  ⚠️  Vision no encontró array válido: ${content.slice(0, 60)}`);
      }
    } catch (e) {
      console.error(`  Error Vision:`, e.message);
    }

    // Armar datos históricos
    if (historicalData.dailyValues.length > 0) {
      const historyArray = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalizar a inicio del día
      
      // Tomar solo los últimos 'period' valores (en caso Vision devuelva más)
      const valuesToUse = historicalData.dailyValues.slice(-period);
      
      for (let i = 0; i < valuesToUse.length; i++) {
        const daysAgo = valuesToUse.length - 1 - i;
        const date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        
        // Saltar cualquier fecha futura
        if (date > today) {
          continue;
        }
        
        const dayNum = date.getDate();
        const monthNum = date.getMonth();
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const fechaStr = `${dayNum} de ${months[monthNum]}`;
        
        historyArray.push({
          fecha: fechaStr,
          valor: valuesToUse[i].toString(),
          timestamp: Math.floor(date.getTime() / 1000),
          date: date.toISOString().split('T')[0]
        });
      }

      const totalValue = historyArray.reduce((sum, item) => {
        return sum + (parseInt(item.valor) || 0);
      }, 0).toString();

      metricsData[metricConfig.name] = {
        totalValue: totalValue,
        historicalData: historyArray,
        totalPoints: historyArray.length
      };

      console.log(`  ✅ ${metricConfig.name}: ${historyArray.length} puntos | Total: ${totalValue}`);
    } else {
      metricsData[metricConfig.name] = {
        totalValue: '0',
        historicalData: [],
        totalPoints: 0
      };

      console.log(`  ⚠️  ${metricConfig.name}: Sin datos`);
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
