const puppeteer = require("puppeteer-core");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Analiza la expiración de las cookies del navegador
 * Devuelve información sobre cookies que caducan pronto, expiradas, etc.
 */
async function analyzeCookieExpiration(page, domain = '.facebook.com') {
  try {
    const pageCoookies = await page.cookies();
    
    const analysisTimestamp = new Date();
    const analysis = {
      analysisTimestamp: analysisTimestamp.toISOString(),
      totalCookies: pageCoookies.length,
      soonestExpiring: null,
      expiredCookies: [],
      expiringInWeek: [],
      allCookies: []
    };

    let soonestExpiryTime = Infinity;

    for (const cookie of pageCoookies) {
      // Si no tiene expires o es -1, es una session cookie
      if (!cookie.expires || cookie.expires === -1) {
        analysis.allCookies.push({
          name: cookie.name,
          domain: cookie.domain,
          status: 'SESSION',
          expirationDate: 'Never (session cookie)'
        });
        continue;
      }

      const expiryDate = new Date(cookie.expires * 1000);
      const now = new Date();
      const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      // Formatear fecha
      const monthNum = expiryDate.getMonth();
      const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const dayNum = expiryDate.getDate();
      const hours = String(expiryDate.getHours()).padStart(2, '0');
      const minutes = String(expiryDate.getMinutes()).padStart(2, '0');
      const seconds = String(expiryDate.getSeconds()).padStart(2, '0');
      const ampm = expiryDate.getHours() >= 12 ? 'p.m.' : 'a.m.';
      const formattedDate = `${dayNum}/${months[monthNum]}/${expiryDate.getFullYear()}, ${hours}:${minutes}:${seconds} ${ampm}`;

      let status = 'VALID';
      
      if (daysUntilExpiry < 0) {
        status = 'EXPIRED';
        analysis.expiredCookies.push({
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysOverdue: Math.abs(daysUntilExpiry)
        });
      } else if (daysUntilExpiry < 7) {
        status = 'EXPIRING_SOON';
        analysis.expiringInWeek.push({
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysRemaining: daysUntilExpiry
        });
      }

      analysis.allCookies.push({
        name: cookie.name,
        domain: cookie.domain,
        expirationDate: expiryDate.toISOString(),
        expirationDateFormatted: formattedDate,
        daysUntilExpiry: Math.round(daysUntilExpiry * 100) / 100,
        status: status
      });

      if (daysUntilExpiry > 0 && daysUntilExpiry < soonestExpiryTime) {
        soonestExpiryTime = daysUntilExpiry;
        analysis.soonestExpiring = {
          name: cookie.name,
          domain: cookie.domain,
          expirationDate: formattedDate,
          daysUntilExpiry: Math.round(daysUntilExpiry * 100) / 100
        };
      }
    }

    return analysis;
  } catch (e) {
    console.error('⚠️  Error analizando cookies:', e.message);
    return {
      analysisTimestamp: new Date().toISOString(),
      totalCookies: 0,
      soonestExpiring: null,
      expiredCookies: [],
      expiringInWeek: [],
      allCookies: [],
      error: e.message
    };
  }
}

/**
 * Parsea cookies de cualquier formato (string JSON, objeto, array)
 * Soporta dos formatos principales:
 * 1. Array de objetos: [{name: "x", value: "y"}, ...]
 * 2. Objeto plano con propiedades: {"cookieName": "value", ...}
 * 3. Array con objeto plano: [{"cookieName": "value", ...}]
 * 4. String JSON (escapado o no)
 */
function parseCookies(cookies, domain = '.facebook.com') {
  if (!cookies) return [];
  
  // Si es string, parsearlo
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
  
  // Si es array, procesarlo
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
        .filter(cookie => cookie && cookie.name && cookie.value) // Validar que tenga name y value
        .map(cookie => {
          const processed = {
            name: String(cookie.name),
            value: String(cookie.value),
            domain: cookie.domain || domain,
            path: cookie.path || '/'
          };
          
          // Agregar campos opcionales si existen
          if (cookie.secure !== undefined) processed.secure = Boolean(cookie.secure);
          if (cookie.httpOnly !== undefined) processed.httpOnly = Boolean(cookie.httpOnly);
          if (cookie.expires !== undefined) processed.expires = Number(cookie.expires);
          if (cookie.sameSite) processed.sameSite = String(cookie.sameSite);
          
          return processed;
        });
    }
  } 
  // Si es objeto, convertir a array de cookies
  else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies)
      .filter(([name, value]) => name && value) // Validar que name y value existan
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
 * Extrae métricas históricas de TikTok (desglosadas por día) como Facebook/Instagram
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
  await page.setCookie(...cookieArray);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D&activeAnalyticsMetric=shares`;
  
  console.log(`📊 Extrayendo datos de TikTok (Período: últimos ${period} días)...`);
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await sleep(3000);

  const metricsData = {};
  
  const metrics = [
    { name: 'visualizaciones_videos', label: 'Visualizaciones de videos' },
    { name: 'visualizaciones_perfil', label: 'Visualizaciones de perfil' },
    { name: 'me_gusta', label: 'Me gusta' },
    { name: 'comentarios', label: 'Comentarios' },
    { name: 'veces_compartido', label: 'Veces compartido' }
  ];

  console.log('📈 Extrayendo valores históricos de cada métrica...\n');

  // Procesar métricas en paralelo (máximo 2 simultáneamente para no sobrecargar Browserless)
  const batchSize = 2;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    
    await Promise.all(batch.map(metricConfig => extractTikTokMetric(page, metricConfig, period, metricsData)));
  }

  await browser.close();
  
  return metricsData;
}

/**
 * Extrae una métrica individual de TikTok
 */
async function extractTikTokMetric(page, metricConfig, period, metricsData) {
  try {
    // Hacer click en la métrica para cambiar el gráfico
    await page.evaluate((label) => {
      // Buscar el botón de la métrica por texto
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], div')).filter(el => {
        return el.textContent.includes(label);
      });
      
      if (buttons.length > 0) {
        buttons[0].click();
      }
    }, metricConfig.label);

    await sleep(1000);  // Reducido de 2000 a 1000ms

    // Extraer todos los puntos del gráfico
    let historicalData = await page.evaluate(() => {
      const result = {
        dailyValues: [],
        dates: []
      };

      // Buscar todos los círculos del gráfico (puntos de datos)
      const circles = document.querySelectorAll('circle[role="presentation"], circle[data-testid], svg circle');
      
      if (circles.length > 0) {
        const values = [];
        
        // Para cada círculo, extraer data attributes
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

      // Si no hay puntos visibles, buscar en rects
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
        
El gráfico muestra hasta ${period} días de datos. Responde SOLO con un array JSON:
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
        const arrayMatch = content.match(/\[\s*\d+[\s\d,]*\]/);
        if (arrayMatch) {
          historicalData.dailyValues = JSON.parse(arrayMatch[0]);
        }
      } catch (e) {
        console.error(`  Error Vision para ${metricConfig.name}:`, e.message);
      }
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

      // Calcular total (suma de todos los días)
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
 * Extrae métricas de TikTok usando Vision de OpenAI (DEPRECATED - usar extractTikTokDataHistorical)
 */
async function extractTikTokData(tiktokCookies, period = 28) {
  return extractTikTokDataHistorical(tiktokCookies, period);
}

/**
 * Extrae métricas de una plataforma (Facebook/Instagram)
 */
async function extractMetrics(cookies, period = 'LAST_28D', platform = 'Facebook', businessId = null, assetId = null) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Parsear cookies (maneja strings JSON, objetos y arrays)
  const cookieArray = parseCookies(cookies, '.facebook.com');
  await page.setCookie(...cookieArray);

  const timeRange = `%2522${period}%2522`;
  
  // Si no hay businessId, usar solo assetId en la URL
  let url;
  if (businessId && assetId) {
    url = `https://business.facebook.com/latest/insights/results?business_id=${businessId}&asset_id=${assetId}&time_range=${timeRange}&platform=${platform}&audience_tab=demographics`;
  } else if (assetId) {
    // Si solo tiene assetId, incluir time_range en la URL
    url = `https://business.facebook.com/latest/insights/results?asset_id=${assetId}&time_range=${timeRange}`;
  } else {
    throw new Error('Se requiere al menos un assetId');
  }

  console.log(`📊 Extrayendo datos de ${platform} (Período: ${period})...`);
  console.log(`   URL: ${url}`);

  await page.goto(url, { waitUntil: "networkidle2" });
  await sleep(2000);
  
  await page.keyboard.press('Escape');
  await sleep(800);
  await page.keyboard.press('Escape');
  await sleep(1500);
  
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: 10000 });

  await sleep(2000);
  
  const metricsData = {};
  
  // Para Instagram, usar "Alcance" en lugar de "Espectadores"
  const isInstagram = platform === 'Instagram';
  const metrics = [
    { name: 'Visualizaciones', keyword: 'Visualizaciones', exclude: isInstagram ? 'Alcance' : 'Espectadores' },
    { name: isInstagram ? 'Alcance' : 'Espectadores', keyword: isInstagram ? 'Alcance' : 'Espectadores', exclude: null },
    { name: 'Interacciones', keyword: 'Interacciones con el contenido', exclude: null },
    { name: 'Clics enlace', keyword: ['Clics en el enlace', 'Clics en enlace', 'Clics del enlace', 'Clics'], exclude: null },
    { name: 'Visitas', keyword: 'Visitas', exclude: 'Clics' },
    { name: 'Seguidores', keyword: 'Seguidores', exclude: null }
  ];
  
  console.log('📈 Extrayendo valores de cada métrica...\n');
  
  for (const metricConfig of metrics) {
    const metricValues = await page.evaluate((config) => {
      const result = {
        metricName: config.name,
        containerText: '',
        timestamps: [],
        dailyValues: [],
        dates: [],
        totalValue: '',
        debugInfo: {}
      };
      
      let targetContainer = null;
      const allDivs = Array.from(document.querySelectorAll('[role="region"], section, article, div'));
      
      // DEBUG: contar coincidencias para keywords problemáticos
      const isClicsMetric = config.keyword && (Array.isArray(config.keyword) ? config.keyword.includes('Clics') : config.keyword === 'Clics');
      let clicsMatches = [];
      
      for (const div of allDivs) {
        const text = div.textContent || '';
        
        // Permitir keywords como string o array
        const keywords = Array.isArray(config.keyword) ? config.keyword : [config.keyword];
        const keywordMatched = keywords.some(kw => text.includes(kw));
        
        // DEBUG: si es métrica "Clics", registrar coincidencias
        if (isClicsMetric && keywordMatched) {
          clicsMatches.push({
            text: text.substring(0, 200),
            hasSvg: !!div.querySelector('svg'),
            length: text.length
          });
        }
        
        if (!keywordMatched) continue;
        
        // Para "Clics", excluir "Visitas" si es necesario
        if (config.keyword && config.keyword.includes('Clics') && text.includes('Visitas')) {
          const clicsIndex = text.indexOf('Clics');
          const visitasIndex = text.indexOf('Visitas');
          if (visitasIndex < clicsIndex) continue;
        }
        
        if (config.exclude && text.includes(config.exclude) && text.indexOf(config.exclude) < text.lastIndexOf(keywords.find(kw => text.includes(kw)))) continue;
        if (text.length > 5000) continue;
        if (!div.querySelector('svg')) continue;
        
        if (targetContainer === null || text.length < targetContainer.textContent.length) {
          targetContainer = div;
        }
      }
      
      // DEBUG: guardar info
      if (isClicsMetric) {
        result.debugInfo = {
          clicsMatchesFound: clicsMatches.length,
          selectedContainer: targetContainer ? 'YES' : 'NO',
          matches: clicsMatches
        };
      }
      
      if (!targetContainer) {
        return result;
      }
      
      result.containerText = targetContainer.innerText;
      
      // DEBUG: guardar texto completo para problematic metrics
      if (isClicsMetric && result.containerText.length < 600) {
        result.debugInfo.containerText = result.containerText.substring(0, 300);
      }
      
      // Extraer valor total
      const containerText = targetContainer.innerText;
      const lines = containerText.split('\n');
      
      let foundMetricName = false;
      const keywords = Array.isArray(config.keyword) ? config.keyword : [config.keyword];
      
      for (const line of lines) {
        if (keywords.some(kw => line.includes(kw))) {
          foundMetricName = true;
        }
        if (foundMetricName && line.match(/\d+[.,]?\d*\s*(mill|mil|k)?/)) {
          result.totalValue = line.trim();
          break;
        }
      }
      
      // Extraer timestamps y valores
      const timestampMatches = containerText.match(/(\d{10})/g) || [];
      const timestamps = [...new Set(timestampMatches)].map(t => parseInt(t)).sort((a, b) => a - b);
      
      // SOLO "Clics enlace" usa extracción con regex para números pegados
      const isClicsEnlaceMetric = config.name === 'Clics enlace';
      
      if (isClicsEnlaceMetric && timestamps.length > 0) {
        // Para "Clics enlace": extraer números de 1-4 dígitos que NO sean timestamps
        const allNumbers = containerText.match(/(\d{1,4}(?!\d{6,}))/g) || [];
        
        const validNumbers = allNumbers
          .map(x => parseInt(x))
          .filter((n, idx, arr) => {
            if (idx > 0 && arr[idx - 1] === n) return false;
            if (n > 10000) return false;
            return true;
          });
        
        if (validNumbers.length >= timestamps.length) {
          result.dailyValues = validNumbers.slice(0, timestamps.length);
        }
      }
      
      // Método original para TODAS las demás métricas
      if (result.dailyValues.length === 0) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('Primary') || (line.match(/\d/g) || []).length > 20) {
            const numbers = line.split('\t').filter(x => x.trim()).map(x => parseInt(x.trim())).filter(n => !isNaN(n) && n < 100000000 && n > 0);
            if (numbers.length > 10) {
              result.dailyValues = numbers.slice(0, Math.min(timestamps.length, 100));
              break;
            }
          }
        }
      }
      
      // Extraer fechas
      const dateMatches = containerText.match(/(\d+)\s+de\s+(\w+)/g) || [];
      result.dates = [...new Set(dateMatches)];
      
      result.timestamps = timestamps.slice(0, result.dailyValues.length);
      
      return result;
    }, metricConfig);
    
    // Procesar timestamps a fechas
    const historicalData = [];
    
    for (let i = 0; i < metricValues.timestamps.length && i < metricValues.dailyValues.length; i++) {
      const date = new Date(metricValues.timestamps[i] * 1000);
      const dayNum = date.getDate();
      const monthNum = date.getMonth();
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const fechaStr = `${dayNum} de ${months[monthNum]}`;
      
      historicalData.push({
        fecha: fechaStr,
        valor: metricValues.dailyValues[i].toString(),
        timestamp: metricValues.timestamps[i],
        date: date.toISOString().split('T')[0]
      });
    }
    
    // Calcular totalValue sumando values históricos
    // EXCEPTO Espectadores (cuentas únicas de Facebook, no sumable)
    let calculatedTotal = metricValues.totalValue;
    
    const metricNameForComparison = metricConfig.name;
    if (metricNameForComparison === 'Espectadores' && historicalData.length > 0) {
      // Para Espectadores (Facebook): usar el último valor (es una métrica de cuentas únicas)
      const lastValue = historicalData[historicalData.length - 1]?.valor;
      if (lastValue) calculatedTotal = lastValue;
    } else if (historicalData.length > 0) {
      // Para todas las demás métricas (incluyendo Seguidores y Alcance de Instagram): sumar
      const sum = historicalData.reduce((acc, item) => {
        return acc + (parseInt(item.valor) || 0);
      }, 0);
      calculatedTotal = sum.toString();
    }
    
    metricsData[metricConfig.name] = {
      totalValue: calculatedTotal,
      historicalData: historicalData,
      totalPoints: historicalData.length,
      ...(metricValues.debugInfo && Object.keys(metricValues.debugInfo).length > 0 && { debugInfo: metricValues.debugInfo })
    };
    
    console.log(`  ✅ ${metricConfig.name}: ${historicalData.length} puntos | Total: ${calculatedTotal}`);
  }

  // Analizar expiración de cookies
  const cookieAnalysis = await analyzeCookieExpiration(page, '.facebook.com');

  await browser.close();

  return {
    platform: platform,
    period: period,
    url: url,
    extractedAt: new Date().toISOString(),
    metrics: metricsData,
    cookies: cookieAnalysis
  };
}

/**
 * Normaliza cookies sin importar cómo lleguen (string, objeto, array)
 * Maneja stringificación múltiple de n8n
 */
function normalizeCookies(input) {
  if (!input) return null;
  
  let parsed = input;
  
  // Si es string, intentar parsearlo recursivamente
  if (typeof input === 'string') {
    // Limpiar espacios y caracteres raros
    let cleaned = input.trim();
    
    // Intentar parsear JSON múltiples veces (en caso de doble stringificación)
    let attempts = 0;
    while (typeof parsed === 'string' && attempts < 5) {
      try {
        parsed = JSON.parse(parsed);
        attempts++;
      } catch (e) {
        break;
      }
    }
    
    // Si sigue siendo string, ya no es JSON válido
    if (typeof parsed === 'string') {
      console.error('⚠️  No se pudo parsear como JSON:', parsed.substring(0, 50));
      return null;
    }
  }
  
  // Si llegó hasta aquí, parsed es array u objeto
  return parsed;
}

// Vercel API Handler
module.exports = async (req, res) => {
  try {
    const rawBody = req.body;
    let { cookies, tiktokCookies, period = 'LAST_28D', businessId = null, assetId = '1299529110060474', includeTikTok = false } = rawBody;
    
    // Normalizar cookies de Facebook
    cookies = normalizeCookies(cookies);
    
    if (!cookies) {
      return res.status(400).json({ 
        error: 'Cookies are required and must be valid JSON',
        received: typeof rawBody.cookies,
        tip: 'Cookies deben ser: array de objetos {name, value, ...} O objeto {key: value}'
      });
    }
    
    // Normalizar cookies de TikTok si existen
    if (tiktokCookies) {
      tiktokCookies = normalizeCookies(tiktokCookies);
    }

    console.log('\n🚀 Iniciando extracción multi-plataforma...\n');

    const results = {
      timestamp: new Date().toISOString(),
      period: period,
      platforms: {}
    };

    // Extraer Facebook
    try {
      console.log('⏳ Facebook...');
      results.platforms.facebook = await extractMetrics(cookies, period, 'Facebook', businessId, assetId);
      console.log('✅ Facebook completado\n');
    } catch (error) {
      console.error('❌ Error en Facebook:', error.message);
      results.platforms.facebook = { error: error.message, success: false };
    }

    // Extraer Instagram
    try {
      console.log('⏳ Instagram...');
      results.platforms.instagram = await extractMetrics(cookies, period, 'Instagram', businessId, assetId);
      console.log('✅ Instagram completado\n');
    } catch (error) {
      console.error('❌ Error en Instagram:', error.message);
      results.platforms.instagram = { error: error.message, success: false };
    }

    // Extraer TikTok (ahora en endpoint separado /api/extract-tiktok)
    // if (tiktokCookies && includeTikTok) {
    //   try {
    //     console.log('⏳ TikTok...');
    //     const tiktokPeriod = 28;
    //     const tiktokRawData = await extractTikTokData(tiktokCookies, tiktokPeriod);
    //     
    //     results.platforms.tiktok = {
    //       platform: 'TikTok',
    //       period: 'LAST_28D',
    //       extractedAt: new Date().toISOString(),
    //       metrics: tiktokRawData
    //     };
    //     
    //     console.log('✅ TikTok completado\n');
    //   } catch (error) {
    //     console.error('❌ Error en TikTok:', error.message);
    //     results.platforms.tiktok = { error: error.message, success: false };
    //   }
    // }

    console.log('✅ Extracción completada\n');

    return res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ Error general:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
