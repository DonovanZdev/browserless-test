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
    cookieArray = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || domain,
      path: cookie.path || '/'
    }));
  } 
  // Si es objeto, convertir a array
  else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies).map(([name, value]) => ({
      name,
      value: String(value), // Asegurar que es string
      domain,
      path: '/'
    }));
  }
  
  // Filtrar cookies inválidas (deben tener name y value)
  const validCookies = cookieArray.filter(cookie => {
    if (!cookie.name || !cookie.value) {
      console.warn(`Cookie inválida ignorada: ${cookie.name || 'sin-name'}`);
      return false;
    }
    return true;
  });
  
  return validCookies;
}

async function extractMetaData(cookies, url, platform) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCookie(...cookies);

  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  await sleep(2000);
  
  await page.keyboard.press('Escape');
  await sleep(800);
  await page.keyboard.press('Escape');
  await sleep(1500);
  
  // Esperar a que la página esté completamente renderizada
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: 10000 });

  // Extraer números exactos del DOM de forma más inteligente
  const pageContent = await page.evaluate(() => {
    const allText = document.body.innerText;
    
    // Crear objeto para almacenar números exactos por métrica
    const metrics = {
      visualizaciones: null,
      espectadores: null,
      interacciones: null,
      clics_enlace: null,
      visitas: null,
      seguidores: null,
      periodo: null
    };
    
    // Buscar específicamente por labels conocidos
    const allElements = Array.from(document.querySelectorAll('*'));
    
    allElements.forEach(el => {
      const text = (el.innerText || el.textContent || '').trim();
      const html = el.outerHTML;
      const ariaLabel = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      
      // Extraer números del elemento actual y hermanos
      const parent = el.parentElement;
      const siblingsText = parent ? (parent.innerText || parent.textContent || '') : '';
      
      // Buscar "Visualizaciones" y su número
      if (text.includes('Visualizaciones') || ariaLabel.includes('Visualizaciones')) {
        // Extraer todos los números del texto
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.visualizaciones) {
          metrics.visualizaciones = allNumbers[0];
        }
      }
      // Buscar "Espectadores" 
      if (text.includes('Espectadores') || ariaLabel.includes('Espectadores')) {
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.espectadores) {
          metrics.espectadores = allNumbers[0];
        }
      }
      // Buscar "Interacciones"
      if (text.includes('Interacciones')) {
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.interacciones) {
          metrics.interacciones = allNumbers[0];
        }
      }
      // Buscar "Clics"
      if (text.includes('Clics en el enlace') || (text.includes('Clics') && !text.includes('Visitas'))) {
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.clics_enlace) {
          metrics.clics_enlace = allNumbers[0];
        }
      }
      // Buscar "Visitas"
      if (text.includes('Visitas') && !text.includes('Clics')) {
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.visitas) {
          metrics.visitas = allNumbers[0];
        }
      }
      // Buscar "Seguidores"
      if (text.includes('Seguidores')) {
        const allNumbers = siblingsText.match(/\d+[.,]?\d*/g) || [];
        if (allNumbers.length > 0 && !metrics.seguidores) {
          metrics.seguidores = allNumbers[0];
        }
      }
      // Buscar período (fechas)
      if ((text.includes(' de ') || text.includes('de dic') || text.includes('dic')) && (text.includes('dic') || text.includes('ene') || text.includes('feb'))) {
        if (!metrics.periodo) metrics.periodo = text;
      }
    });
    
    return {
      fullText: allText,
      extractedMetrics: metrics
    };
  });
  
  await browser.close();
  
  // Usar OpenAI para refinar los números extraídos
  let prompt;
  if (platform === 'instagram') {
    prompt = "Convierte estos números de Instagram a formato completo sin 'mill' o 'mil': " + JSON.stringify(pageContent.extractedMetrics) + " Responde SOLO en JSON: {\"visualizaciones\": \"XXX\", \"espectadores\": \"XXX\", \"interacciones\": \"XXX\", \"clics_enlace\": \"XXX\", \"alcance\": \"XXX\", \"seguidores\": \"XXX\", \"periodo\": \"X - X\"}";
  } else if (platform === 'tiktok') {
    prompt = "Convierte estos números de TikTok a formato completo: " + JSON.stringify(pageContent.extractedMetrics) + " Responde SOLO en JSON: {\"visualizaciones_videos\": \"XXX\", \"visualizaciones_perfil\": \"XXX\", \"me_gusta\": \"XXX\", \"comentarios\": \"XXX\", \"veces_compartido\": \"XXX\", \"recompensas_estimadas\": \"XXX\", \"periodo\": \"Los últimos X días\"}";
  } else {
    prompt = "Recibiste números extraídos de Facebook Business Suite. Mapéalos correctamente a sus métricas: " + JSON.stringify(pageContent.extractedMetrics) + ". El primer número grande (500+ mill) es Visualizaciones, el segundo (20-30 mill) es Espectadores, el tercero (3-5 mill) es Interacciones, el cuarto (80-100 mil) es Clics en el enlace, el quinto es Visitas, el sexto es Seguidores. IMPORTANTE: Convierte a números COMPLETOS sin abreviaciones (518.6 mill = 518600000, 29.8 mill = 29800000, 89.2 mil = 89200). Responde SOLO en JSON: {\"visualizaciones\": \"518600000\", \"espectadores\": \"29800000\", \"interacciones\": \"3400000\", \"clics_enlace\": \"89200\", \"visitas\": \"2500000\", \"seguidores\": \"37200\", \"periodo\": \"3 de dic - 30 de dic\"}";
  }
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 500,
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

async function extractTikTokData(tiktokCookies, period = 7) {
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
  
  if (cookieArray.length === 0) {
    throw new Error('No valid cookies found for TikTok');
  }
  
  try {
    await page.setCookie(...cookieArray);
  } catch (e) {
    console.error('Error setting TikTok cookies:', e.message);
    throw e;
  }

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
  const prompt = `En esta screenshot de TikTok Studio para el período de los últimos ${period} días, extrae EXACTAMENTE estos KPIs de la sección de 'Métricas clave': 1) Visualizaciones de videos, 2) Visualizaciones de perfil, 3) Me gusta, 4) Comentarios, 5) Veces compartido, 6) Recompensas estimadas. TAMBIÉN extrae el PERIODO exacto que aparece en la esquina superior derecha. Responde SOLO en JSON: {\"visualizaciones_videos\": \"XXX\", \"visualizaciones_perfil\": \"XXX\", \"me_gusta\": \"XXX\", \"comentarios\": \"XXX\", \"veces_compartido\": \"XXX\", \"recompensas_estimadas\": \"$XXX\", \"periodo\": \"Los últimos X días\"}`;
  
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  try {
    const { cookies, platform, meta_cookies, tiktok_cookies, tiktok_period, facebook_period, include_exports } = req.body;
    
    // Soporte para cookies: meta_cookies para Facebook/Instagram, tiktok_cookies para TikTok
    const cookieMap = {
      facebook: meta_cookies || cookies,
      instagram: meta_cookies || cookies,
      tiktok: tiktok_cookies || cookies
    };
    
    if (!meta_cookies && !tiktok_cookies && !cookies) {
      return res.status(400).json({ error: "Se requieren meta_cookies y/o tiktok_cookies" });
    }
    
    // Función para construir URL de Facebook con período dinámico
    function buildFacebookUrl(period = 'LAST_28D') {
      const businessId = '176166689688823';
      const assetId = '8555156748';
      const timeRange = `%2522${period}%2522`; // URL encoded de "%22PERIOD%22"
      return `https://business.facebook.com/latest/insights/results?business_id=${businessId}&asset_id=${assetId}&time_range=${timeRange}&platform=Facebook&audience_tab=demographics`;
    }
    
    // URLs base para Facebook, Instagram y TikTok
    const urls = {
      facebook: buildFacebookUrl(facebook_period || 'LAST_28D'),
      instagram: buildFacebookUrl(facebook_period || 'LAST_28D'),
      tiktok: "https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A7%7D&activeAnalyticsMetric=shares"
    };
    
    // Determinar qué plataformas extraer
    let platformsToExtract = ['facebook', 'instagram', 'tiktok'];
    if (platform && (platform === 'facebook' || platform === 'instagram' || platform === 'tiktok')) {
      platformsToExtract = [platform];
    }
    
    const results = {};
    
    for (const plat of platformsToExtract) {
      const plat_cookies = cookieMap[plat];
      if (!plat_cookies) {
        console.log(`Saltando ${plat} - sin cookies`);
        continue;
      }
      
      // Parsear cookies (maneja strings JSON, objetos y arrays)
      const cookieArray = parseCookies(plat_cookies, plat === 'tiktok' ? '.tiktok.com' : '.facebook.com');
      
      if (plat === 'tiktok') {
        // Para TikTok, usar con período
        console.log(`Extrayendo datos de ${plat}...`);
        results[plat] = await extractTikTokData(cookieArray, tiktok_period || 28);
      } else {
        // Para Facebook/Instagram
        console.log(`Extrayendo datos de ${plat}...`);
        results[plat] = await extractMetaData(cookieArray, urls[plat], plat);
      }
    }
    
    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
