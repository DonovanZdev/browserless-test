const puppeteer = require("puppeteer-core");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

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

  const rendimientoData = await page.evaluate((plat) => {
    const data = {};
    
    if (plat === 'instagram') {
      // Para Instagram, buscar por estructura HTML más específica
      
      // Visualizaciones
      const vizSection = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('Visualizaciones') && el.textContent?.includes('mill.')
      );
      if (vizSection) {
        const vizMatch = vizSection.textContent.match(/Visualizaciones[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (vizMatch) data.visualizaciones = vizMatch[1];
      }
      
      // Alcance de Instagram
      const alcanceSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Alcance de Instagram') && el.textContent?.includes('mill.')
      );
      if (alcanceSection) {
        const alcanceMatch = alcanceSection.textContent.match(/Alcance de Instagram[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (alcanceMatch) data.alcance = alcanceMatch[1];
      }
      
      // Interacciones
      const intSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Interacciones con el contenido') && el.textContent?.includes('mill.')
      );
      if (intSection) {
        const intMatch = intSection.textContent.match(/Interacciones con el contenido[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (intMatch) data.interacciones = intMatch[1];
      }
      
      // Seguidores - buscar específicamente el número grande en la sección de Seguidores
      const allDivs = document.querySelectorAll('[class*="insight"], [class*="stat"], div');
      for (let div of allDivs) {
        if (div.textContent?.includes('Seguidores') && 
            !div.textContent?.includes('Personas que dejaron')) {
          // Buscar el número más grande en mil dentro de esta sección
          const matches = div.textContent.match(/(\d+[\s,]*\d*)\s*mil(?![\.,])/g);
          if (matches && matches.length > 0) {
            // Tomar el primer match que no sea muy pequeño
            data.seguidores = matches[0];
            break;
          }
        }
      }
    } else {
      // Para Facebook
      const vizSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Visualizaciones') && el.textContent?.includes('mill.')
      );
      if (vizSection) {
        const vizMatch = vizSection.textContent.match(/Visualizaciones[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (vizMatch) data.visualizaciones = vizMatch[1];
      }
      
      const intSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Interacciones con el contenido') && el.textContent?.includes('mill.')
      );
      if (intSection) {
        const intMatch = intSection.textContent.match(/Interacciones con el contenido[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (intMatch) data.interacciones = intMatch[1];
      }
      
      const visitSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Visitas de Facebook') && el.textContent?.includes('mill.')
      );
      if (visitSection) {
        const visitMatch = visitSection.textContent.match(/Visitas de Facebook[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
        if (visitMatch) data.visitas = visitMatch[1];
      }
      
      const followSection = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Seguidores') && el.textContent?.includes('mil') &&
        !el.textContent?.includes('Personas que dejaron')
      );
      if (followSection) {
        const followMatch = followSection.textContent.match(/(\d+[\s,]*\d*)\s*mil/);
        if (followMatch) data.seguidores = followMatch[1];
      }
    }
    
    return data;
  }, platform);
  
  await browser.close();
  return rendimientoData;
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
