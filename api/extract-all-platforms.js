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
 * Parsea cookies de cualquier formato (string JSON, objeto, array)
 * y limpia campos no válidos para Puppeteer
 */
function parseCookies(cookies, domain = '.facebook.com') {
  if (!cookies) return [];
  
  // Si es string, parsearlo
  if (typeof cookies === 'string') {
    try {
      cookies = JSON.parse(cookies);
    } catch (e) {
      console.error('Error parseando cookies:', e.message);
      return [];
    }
  }
  
  let cookieArray = [];
  
  // Si es array, procesarlo
  if (Array.isArray(cookies)) {
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
  // Si es objeto, convertir a array de cookies
  else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies)
      .filter(([name, value]) => name && value) // Validar que name y value existan
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
 * Extrae métricas de TikTok usando Vision de OpenAI
 */
async function extractTikTokData(tiktokCookies, period = 28) {
  if (!tiktokCookies) {
    throw new Error("TikTok cookies requeridas");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Parsear cookies (maneja strings JSON, objetos y arrays)
  const cookieArray = parseCookies(tiktokCookies, '.tiktok.com');
  await page.setCookie(...cookieArray);

  // Construir URL con período dinámico
  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D&activeAnalyticsMetric=shares`;
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await sleep(3000);
  
  // Tomar screenshot en base64
  const screenshot = await page.screenshot({ encoding: 'base64' });
  
  await browser.close();
  
  // Usar OpenAI Vision para extraer datos
  const prompt = `En esta screenshot de TikTok Studio para el período de los últimos ${period} días, extrae EXACTAMENTE estos KPIs de la sección de 'Métricas clave': 1) Visualizaciones de videos, 2) Visualizaciones de perfil, 3) Me gusta, 4) Comentarios, 5) Veces compartido, 6) Recompensas estimadas. TAMBIÉN extrae el PERIODO exacto que aparece en la esquina superior derecha. Responde SOLO en JSON: {"visualizaciones_videos": "XXX", "visualizaciones_perfil": "XXX", "me_gusta": "XXX", "comentarios": "XXX", "veces_compartido": "XXX", "recompensas_estimadas": "$XXX", "periodo": "Los últimos X días"}`;
  
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
    max_tokens: 200,
  });

  // Parsear respuesta de OpenAI
  let data = {};
  try {
    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      data = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Error parsing OpenAI response:", e);
  }
  
  return data;
}

/**
 * Extrae métricas de una plataforma (Facebook/Instagram)
 */
async function extractMetrics(cookies, period = 'LAST_28D', platform = 'Facebook', businessId = '176166689688823', assetId = '8555156748') {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Parsear cookies (maneja strings JSON, objetos y arrays)
  const cookieArray = parseCookies(cookies, '.facebook.com');
  await page.setCookie(...cookieArray);

  const timeRange = `%2522${period}%2522`;
  const url = `https://business.facebook.com/latest/insights/results?business_id=${businessId}&asset_id=${assetId}&time_range=${timeRange}&platform=${platform}&audience_tab=demographics`;

  console.log(`📊 Extrayendo datos de ${platform} (Período: ${period})...`);

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
  
  const metrics = [
    { name: 'Visualizaciones', keyword: 'Visualizaciones', exclude: 'Espectadores' },
    { name: 'Espectadores', keyword: 'Espectadores', exclude: null },
    { name: 'Interacciones', keyword: 'Interacciones con el contenido', exclude: null },
    { name: 'Clics enlace', keyword: 'Clics en el enlace', exclude: null },
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
        totalValue: ''
      };
      
      let targetContainer = null;
      const allDivs = Array.from(document.querySelectorAll('[role="region"], section, article, div'));
      
      for (const div of allDivs) {
        const text = div.textContent || '';
        
        if (!text.includes(config.keyword)) continue;
        if (config.exclude && text.includes(config.exclude) && text.indexOf(config.exclude) < text.indexOf(config.keyword)) continue;
        if (text.length > 5000) continue;
        if (!div.querySelector('svg')) continue;
        
        if (targetContainer === null || text.length < targetContainer.textContent.length) {
          targetContainer = div;
        }
      }
      
      if (!targetContainer) {
        return result;
      }
      
      result.containerText = targetContainer.innerText;
      
      // Extraer valor total
      const containerText = targetContainer.innerText;
      const lines = containerText.split('\n');
      
      let foundMetricName = false;
      for (const line of lines) {
        if (line.includes(config.keyword)) {
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
      
      // Buscar valores
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
    
    metricsData[metricConfig.name] = {
      totalValue: metricValues.totalValue,
      historicalData: historicalData,
      totalPoints: historicalData.length
    };
    
    console.log(`  ✅ ${metricConfig.name}: ${historicalData.length} puntos`);
  }

  await browser.close();

  return {
    platform: platform,
    period: period,
    extractedAt: new Date().toISOString(),
    metrics: metricsData
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
    let { cookies, tiktokCookies, period = 'LAST_28D', businessId = '176166689688823', assetId = '8555156748', includeTikTok = false } = rawBody;
    
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

    // Extraer TikTok
    if (tiktokCookies && includeTikTok) {
      try {
        console.log('⏳ TikTok...');
        const tiktokPeriod = 28; // 28 días por defecto
        results.platforms.tiktok = await extractTikTokData(tiktokCookies, tiktokPeriod);
        console.log('✅ TikTok completado\n');
      } catch (error) {
        console.error('❌ Error en TikTok:', error.message);
        results.platforms.tiktok = { error: error.message, success: false };
      }
    }

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
