const puppeteer = require("puppeteer-core");
const { OpenAI } = require("openai");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  
  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight * 3);
  });
  await sleep(2000);

  // Tomar screenshot en base64
  const screenshot = await page.screenshot({ encoding: 'base64' });
  
  await browser.close();
  
  // Usar OpenAI Vision para extraer datos
  let prompt;
  if (platform === 'instagram') {
    prompt = "En esta screenshot de Instagram Business Suite, extrae EXACTAMENTE estos KPIs de la sección INFERIOR DERECHA que dice 'Seguidores': 1) Visualizaciones (número grande en mill. de la sección superior izquierda), 2) Alcance de Instagram (número grande en mill. de la sección superior derecha), 3) Interacciones con el contenido (número en mill. de la sección inferior izquierda), 4) Seguidores (número en mil. de la sección inferior derecha, debe ser un número pequeño como 6 mil, NO los 718,840 que aparecen bajo 'De seguidores'). Responde SOLO en JSON sin explicaciones: {\"visualizaciones\": \"XXX mill.\", \"alcance\": \"XXX mill.\", \"interacciones\": \"XXX mill.\", \"seguidores\": \"X.X mil\"}";
  } else if (platform === 'tiktok') {
    prompt = "En esta screenshot de TikTok Studio, extrae EXACTAMENTE estos KPIs de la sección de 'Métricas clave': 1) Visualizaciones de videos (número principal en la primera tarjeta), 2) Visualizaciones de perfil (número en la segunda tarjeta), 3) Me gusta (número total de likes recibidos), 4) Comentarios (número total de comentarios), 5) Veces compartido (número total de shares), 6) Recompensas estimadas (número con $ si aplica). Responde SOLO en JSON sin explicaciones: {\"visualizaciones_videos\": \"XXX\", \"visualizaciones_perfil\": \"XXX\", \"me_gusta\": \"XXX\", \"comentarios\": \"XXX\", \"veces_compartido\": \"XXX\", \"recompensas_estimadas\": \"$XXX\"}";
  } else {
    prompt = "En esta screenshot de Facebook Business Suite, extrae EXACTAMENTE estos KPIs: 1) Visualizaciones (mill.), 2) Interacciones con el contenido (mill.), 3) Visitas de Facebook (mill.), 4) Seguidores (mil). Responde SOLO en JSON sin explicaciones: {\"visualizaciones\": \"XXX mill.\", \"interacciones\": \"XXX mill.\", \"visitas\": \"XXX mill.\", \"seguidores\": \"XXX mil\"}";
  }
  
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

async function extractTikTokData(tiktokCookies, period = 28) {
  if (!tiktokCookies) {
    throw new Error("TikTok cookies requeridas");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Convertir cookies a array si es necesario
  let cookieArray = tiktokCookies;
  if (typeof tiktokCookies === 'object' && !Array.isArray(tiktokCookies)) {
    cookieArray = Object.entries(tiktokCookies).map(([name, value]) => ({
      name,
      value,
      domain: '.tiktok.com',
      path: '/'
    }));
  }
  
  await page.setCookie(...cookieArray);

  // Construir URL con período dinámico
  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D&activeAnalyticsMetric=video_views`;
  
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
    const { cookies, platform, meta_cookies, tiktok_cookies, tiktok_period } = req.body;
    
    // Soporte para cookies: meta_cookies para Facebook/Instagram, tiktok_cookies para TikTok
    const cookieMap = {
      facebook: meta_cookies || cookies,
      instagram: meta_cookies || cookies,
      tiktok: tiktok_cookies || cookies
    };
    
    if (!meta_cookies && !tiktok_cookies && !cookies) {
      return res.status(400).json({ error: "Se requieren meta_cookies y/o tiktok_cookies" });
    }
    
    // URLs base para Facebook, Instagram y TikTok
    const urls = {
      facebook: "https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D",
      instagram: "https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D&platform=Instagram",
      tiktok: "https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A7%7D&activeAnalyticsMetric=video_views"
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
      
      // Convertir cookies a array si es necesario
      let cookieArray = plat_cookies;
      if (typeof plat_cookies === 'object' && !Array.isArray(plat_cookies)) {
        if (plat === 'tiktok') {
          // Para TikTok, usar con período
          console.log(`Extrayendo datos de ${plat}...`);
          results[plat] = await extractTikTokData(plat_cookies, tiktok_period || 28);
        } else {
          // Para Facebook/Instagram, convertir a array
          cookieArray = Object.entries(plat_cookies).map(([name, value]) => ({
            name,
            value,
            domain: plat === 'tiktok' ? '.tiktok.com' : '.facebook.com'
          }));
          
          console.log(`Extrayendo datos de ${plat}...`);
          results[plat] = await extractMetaData(cookieArray, urls[plat], plat);
        }
      } else {
        console.log(`Extrayendo datos de ${plat}...`);
        if (plat === 'tiktok') {
          results[plat] = await extractTikTokData(plat_cookies, tiktok_period || 28);
        } else {
          results[plat] = await extractMetaData(cookieArray, urls[plat], plat);
        }
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
