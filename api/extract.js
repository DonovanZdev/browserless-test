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
  const prompt = platform === 'instagram' 
    ? "En esta screenshot de Instagram Business Suite, extrae exactamente estos números: Visualizaciones (mill.), Alcance de Instagram (mill.), Interacciones con el contenido (mill.), y Seguidores. Responde en JSON: {\"visualizaciones\": \"XXX mill.\", \"alcance\": \"XXX mill.\", \"interacciones\": \"XXX mill.\", \"seguidores\": \"XXX mil\"}"
    : "En esta screenshot de Facebook Business Suite, extrae exactamente estos números: Visualizaciones (mill.), Interacciones con el contenido (mill.), Visitas de Facebook (mill.), y Seguidores. Responde en JSON: {\"visualizaciones\": \"XXX mill.\", \"interacciones\": \"XXX mill.\", \"visitas\": \"XXX mill.\", \"seguidores\": \"XXX mil\"}";
  
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
    const { cookies, platform } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: "Se requiere un array de cookies" });
    }
    
    // URLs base para Facebook e Instagram
    const urls = {
      facebook: "https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D",
      instagram: "https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D&platform=Instagram"
    };
    
    // Determinar qué plataformas extraer
    let platformsToExtract = ['facebook', 'instagram'];
    if (platform && (platform === 'facebook' || platform === 'instagram')) {
      platformsToExtract = [platform];
    }
    
    const results = {};
    
    for (const plat of platformsToExtract) {
      console.log(`Extrayendo datos de ${plat}...`);
      results[plat] = await extractMetaData(cookies, urls[plat], plat);
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
