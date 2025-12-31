const puppeteer = require("puppeteer-core");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractMetaData(cookies) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCookie(...cookies);

  await page.goto("https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D", {
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

  const rendimientoData = await page.evaluate(() => {
    const data = {};
    const allText = document.body.innerText;
    
    const vizMatch = allText.match(/Visualizaciones[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (vizMatch) data.visualizaciones = vizMatch[1];
    
    const intMatch = allText.match(/Interacciones con el contenido[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (intMatch) data.interacciones = intMatch[1];
    
    const visitMatch = allText.match(/Visitas de Facebook[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (visitMatch) data.visitas = visitMatch[1];
    
    const followMatch = allText.match(/Seguidores[\s\S]*?(\d+[\s,]*\d*\s*mil[l]?\.?)/);
    if (followMatch) data.seguimientos = followMatch[1];
    
    return data;
  });
  
  await browser.close();
  return rendimientoData;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  try {
    const { cookies } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: "Se requiere un array de cookies" });
    }
    
    const data = await extractMetaData(cookies);
    
    res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
