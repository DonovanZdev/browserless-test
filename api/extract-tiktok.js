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
  else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies)
      .filter(([name, value]) => name && value)
      .map(([name, value]) => ({
        name: String(name),
        value: String(value),
        domain,
        path: '/'
      }));
  }

  console.log(`✅ Parseados ${cookieArray.length} cookies válidos para ${domain}`);
  return cookieArray;
}

/**
 * Extrae una métrica individual de TikTok
 */
async function extractTikTokMetric(page, metricConfig, period, metricsData, metricIndex) {
  try {
    console.log(`\n📍 Extrayendo: ${metricConfig.name} (${metricConfig.label}) [índice: ${metricIndex}]`);
    
    // Intentar hacer click por índice en lugar de por label
    const clickSuccess = await page.evaluate((index) => {
      // Buscar todas las tarjetas de métricas (usualmente están en contenedores específicos)
      const metricCards = document.querySelectorAll('[role="button"] > div, [data-testid*="metric"], .metrics-card, [class*="metric"]');
      
      if (metricCards.length > index) {
        metricCards[index].click();
        return true;
      }
      
      // Fallback: buscar por label
      return false;
    }, metricIndex);

    if (!clickSuccess) {
      // Fallback: buscar por label de texto
      const labelFound = await page.evaluate((label) => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], div')).filter(el => {
          return el.textContent.includes(label);
        });
        
        if (buttons.length > 0) {
          buttons[0].click();
          return true;
        }
        return false;
      }, metricConfig.label);
      
      console.log(`  Label found: ${labelFound}, elemento clickeado por texto`);
    } else {
      console.log(`  ✅ Métrica seleccionada por índice`);
    }

    await sleep(1500);

    // Extraer todos los puntos del gráfico
    let historicalData = await page.evaluate(() => {
      const result = {
        dailyValues: [],
        dates: []
      };

      const circles = document.querySelectorAll('circle[role="presentation"], circle[data-testid], svg circle');
      
      if (circles.length > 0) {
        const values = [];
        
        circles.forEach((circle) => {
          const dataValue = circle.getAttribute('data-value') || 
                           circle.getAttribute('aria-label') ||
                           circle.parentElement?.getAttribute('data-value');
          
          if (dataValue) {
            const numMatch = dataValue.match(/\d+/);
            if (numMatch) {
              values.push(parseInt(numMatch[0]));
            }
          }
        });
        
        result.dailyValues = values;
      }

      if (result.dailyValues.length === 0) {
        const rects = document.querySelectorAll('rect[data-testid*="chart"], rect[data-value]');
        rects.forEach(rect => {
          const dataValue = rect.getAttribute('data-value');
          if (dataValue) {
            const numMatch = dataValue.match(/\d+/);
            if (numMatch) {
              result.dailyValues.push(parseInt(numMatch[0]));
            }
          }
        });
      }

      return result;
    });

    // Si tenemos pocos datos, intentar Vision como fallback
    if (historicalData.dailyValues.length < 10) {
      console.log(`  ⚠️  Pocos datos en DOM (${historicalData.dailyValues.length}), usando Vision...`);
      
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      const prompt = `Extrae TODOS los valores diarios del gráfico visible para TikTok Studio ${metricConfig.label}. 
Lee los valores de IZQUIERDA a DERECHA empezando por el día más antiguo al más reciente.
El gráfico muestra hasta ${period} días de datos. 
Responde SOLO con un array JSON con los valores en orden cronológico (más antiguo primero):
[numero1, numero2, numero3, ...]`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${screenshot}`,
                },
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

      try {
        const content = response.choices[0].message.content;
        console.log(`  Vision response para ${metricConfig.name}: ${content}`);
        
        const arrayMatch = content.match(/\[\s*[\d\s,]*\]/);
        if (arrayMatch) {
          const extractedArray = JSON.parse(arrayMatch[0]);
          console.log(`  Valores extraídos: ${JSON.stringify(extractedArray)}`);
          historicalData.dailyValues = extractedArray;
        } else {
          console.log(`  ❌ No se encontró array en response: ${content}`);
        }
      } catch (e) {
        console.error(`  Error Vision para ${metricConfig.name}:`, e.message);
      }
    } else {
      console.log(`  ✅ DOM extraction: ${historicalData.dailyValues.length} puntos encontrados`);
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
