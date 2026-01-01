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
 */
/**
 * Extrae una métrica individual de TikTok
 * Estrategia: Extraer el número total directamente de la tarjeta de métrica
 * Sin necesidad de clickear en el gráfico
 */
async function extractTikTokMetric(page, metricConfig, period, metricsData, metricIndex) {
  try {
    console.log(`\n📍 Extrayendo: ${metricConfig.name} (índice: ${metricIndex})`);
    
    // Extraer el número total de la tarjeta de métrica
    const metricData = await page.evaluate((label, index) => {
      // Estrategia 1: Buscar por label exacto (nombre de la métrica)
      const allDivs = Array.from(document.querySelectorAll('div, span'));
      
      let totalValue = null;
      let nextNumbers = [];
      
      // Buscar el elemento que contiene el label
      for (let el of allDivs) {
        if (el.textContent.trim() === label || el.textContent.trim().includes(label)) {
          // Subir en el árbol para encontrar la tarjeta padre
          let parent = el;
          for (let i = 0; i < 5; i++) {
            if (parent.parentElement) {
              parent = parent.parentElement;
              // Buscar números grandes en esta tarjeta
              const numbers = Array.from(parent.querySelectorAll('*'))
                .map(e => ({
                  num: parseInt(e.textContent?.match(/^\d+$/)?.[0] || 0),
                  text: e.textContent?.trim()
                }))
                .filter(x => x.num > 0 && x.text.match(/^\d+$/));
              
              if (numbers.length > 0) {
                // El primer número grande suele ser el total
                totalValue = numbers[0].num;
                break;
              }
            }
          }
          if (totalValue) break;
        }
      }
      
      // Estrategia 2: Si no encontró por label, usar el índice
      if (!totalValue) {
        const cards = document.querySelectorAll('[data-testid], [class*="metric"], div[role="button"]');
        if (cards[index]) {
          const numbers = Array.from(cards[index].querySelectorAll('*'))
            .map(e => parseInt(e.textContent?.match(/^\d+$/)?.[0] || 0))
            .filter(n => n > 0);
          if (numbers.length > 0) {
            totalValue = Math.max(...numbers);
          }
        }
      }
      
      return {
        totalValue,
        found: totalValue !== null
      };
    }, metricConfig.label, metricIndex);

    if (metricData.found) {
      console.log(`  ✅ Total encontrado: ${metricData.totalValue}`);
    } else {
      console.log(`  ⚠️  No se encontró número total, usando Vision para el gráfico`);
    }

    // Ahora extraer los datos del gráfico
    let historicalData = await page.evaluate(() => {
      const result = {
        dailyValues: [],
        dates: [],
        totalValue: null
      };

      // Buscar SVG circles
      const circles = document.querySelectorAll('circle');
      
      if (circles.length > 0) {
        const values = [];
        
        circles.forEach((circle) => {
          const dataValue = circle.getAttribute('data-value') || 
                           circle.getAttribute('aria-label') ||
                           circle.getAttribute('title');
          
          if (dataValue) {
            const numMatch = dataValue.match(/\d+/);
            if (numMatch) {
              values.push(parseInt(numMatch[0]));
            }
          }
        });
        
        if (values.length > 0) {
          result.dailyValues = values;
        }
      }

      return result;
    });

    // Extraer todos los puntos del gráfico
    let historicalData = await page.evaluate(() => {
      const result = {
        dailyValues: [],
        dates: [],
        totalValue: null  // Capturar el total mostrado en UI
      };

      // PRIMERO: Extraer el número total mostrado en la tarjeta de la métrica
      // Este es el número grande mostrado encima del gráfico
      const allText = document.body.innerText;
      const regex = /(\d+)\s*\(.*?%\)|Visualizaciones|Me gusta|Comentarios|Veces/;
      
      // Buscar el número más grande visible en la página (probablemente el total)
      const numbers = [];
      document.querySelectorAll('span, div').forEach(el => {
        const text = el.innerText?.trim();
        if (text && /^\d+$/.test(text) && text.length > 0) {
          const num = parseInt(text);
          if (num > 0) numbers.push({ num, el });
        }
      });
      
      // El número más grande es probablemente el total
      if (numbers.length > 0) {
        numbers.sort((a, b) => b.num - a.num);
        result.totalValue = numbers[0].num;
      }

      // Estrategia 1: Buscar SVG circles con tooltips o aria-labels
      const circles = document.querySelectorAll('circle[role="presentation"], circle[data-testid], svg circle');
      
      if (circles.length > 0) {
        const values = [];
        
        circles.forEach((circle) => {
          // Buscar valor en múltiples atributos
          const dataValue = circle.getAttribute('data-value') || 
                           circle.getAttribute('aria-label') ||
                           circle.getAttribute('title') ||
                           circle.parentElement?.getAttribute('data-value') ||
                           circle.parentElement?.getAttribute('aria-label');
          
          if (dataValue) {
            const numMatch = dataValue.match(/\d+/);
            if (numMatch) {
              values.push(parseInt(numMatch[0]));
            }
          }
        });
        
        // Si encontramos valores desde los atributos
        if (values.length > 0) {
          result.dailyValues = values;
        } else {
          // Estrategia alternativa: usar position y tamaño del círculo para inferir valor
          // TikTok usa la altura/posición para representar el valor en un gráfico de barras
          const yCoords = Array.from(circles).map(c => {
            const cy = parseFloat(c.getAttribute('cy') || 0);
            return cy;
          });
          
          if (yCoords.length > 0) {
            const maxY = Math.max(...yCoords);
            const minY = Math.min(...yCoords);
            const range = maxY - minY || 1;
            
            result.dailyValues = yCoords.map(cy => {
              // Invertir porque SVG tiene Y invertida (0 en arriba)
              const normalized = (maxY - cy) / range;
              const value = Math.round(normalized * 100); // Escalar a 0-100
              return value;
            });
          }
        }
      }

      // Si aún no tenemos datos, intentar con rects
      if (result.dailyValues.length === 0) {
        const rects = document.querySelectorAll('rect[data-testid*="chart"], rect[data-value], rect[aria-label]');
        const values = [];
        
        rects.forEach(rect => {
          const dataValue = rect.getAttribute('data-value') || 
                           rect.getAttribute('aria-label') ||
                           rect.getAttribute('title');
          
          if (dataValue) {
            const numMatch = dataValue.match(/\d+/);
            if (numMatch) {
              values.push(parseInt(numMatch[0]));
            }
          }
        });
        
        if (values.length > 0) {
          result.dailyValues = values;
        }
      }

      return result;
    });

    // Si tenemos pocos datos, intentar Vision como fallback
    if (historicalData.dailyValues.length < 10) {
      console.log(`  ⚠️  DOM extraction: ${historicalData.dailyValues.length} puntos (usando Vision)`);
      
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      const prompt = `TAREA CRÍTICA: Extrae los valores EXACTOS del gráfico de TikTok Studio.

INSTRUCCIONES:
1. Identifica el NÚMERO GRANDE mostrado en la tarjeta (ej: 40, 5, 3, 1, 0) - este es el TOTAL
2. El número grande debe ser la SUMA de todos los valores del gráfico
3. Lee el gráfico de IZQUIERDA a DERECHA (día más antiguo → día más reciente)
4. Si ves barras o líneas, cada punto representa UN día
5. Extrae EXACTAMENTE ${period} valores (o menos si hay vacíos)

FORMATO DE RESPUESTA:
Responde SOLO con un array JSON numérico, SIN texto adicional.
Ejemplo: [0, 0, 1, 0, 2, 5, 3, 1]

El TOTAL debe sumar exactamente al número grande mostrado en la tarjeta.`;
      
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
        max_tokens: 500,
      });

      try {
        const content = response.choices[0].message.content.trim();
        console.log(`  Vision response para ${metricConfig.name}: ${content.slice(0, 80)}...`);
        
        const arrayMatch = content.match(/\[\s*[\d\s,\-]*\]/);
        if (arrayMatch) {
          const extractedArray = JSON.parse(arrayMatch[0]);
          const sum = extractedArray.reduce((a, b) => a + b, 0);
          console.log(`  ✅ Valores extraídos: ${extractedArray.length} puntos, suma total: ${sum}`);
          historicalData.dailyValues = extractedArray;
        } else {
          console.log(`  ❌ No se encontró array JSON válido en response`);
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
