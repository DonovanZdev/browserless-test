// Nuevo endpoint para descargar reportes de Facebook
// POST /api/facebook-export

const puppeteer = require("puppeteer-core");
const { OpenAI } = require("openai");
const fs = require('fs');
const path = require('path');

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Solo POST permitido" });
  }

  try {
    const { meta_cookies, facebook_period = 'LAST_28D', save_locally = false } = req.body;
    
    if (!meta_cookies) {
      return res.status(400).json({ error: "Se requieren meta_cookies" });
    }

    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    let cookieArray = meta_cookies;
    if (typeof meta_cookies === 'object' && !Array.isArray(meta_cookies)) {
      cookieArray = Object.entries(meta_cookies).map(([name, value]) => ({
        name,
        value,
        domain: '.facebook.com'
      }));
    }
    
    await page.setCookie(...cookieArray);

    const businessId = '176166689688823';
    const assetId = '8555156748';
    const timeRange = `%2522${facebook_period}%2522`;
    const url = `https://business.facebook.com/latest/insights/results?business_id=${businessId}&asset_id=${assetId}&time_range=${timeRange}&platform=Facebook&audience_tab=demographics`;
    
    await page.goto(url, { waitUntil: "networkidle2" });
    await sleep(2000);
    
    await page.keyboard.press('Escape');
    await sleep(800);
    await page.keyboard.press('Escape');
    await sleep(1500);

    // Extraer KPIs principales
    const metricsJSON = await page.evaluate(() => {
      const metrics = {
        visualizaciones: null,
        espectadores: null,
        interacciones: null,
        clics_enlace: null,
        visitas: null,
        seguidores: null,
        periodo: null
      };

      // Buscar elementos con números grandes
      const allElements = Array.from(document.querySelectorAll('*'));
      
      allElements.forEach(el => {
        const text = (el.innerText || el.textContent || '').trim();
        const parent = el.parentElement;
        const siblingsText = parent ? (parent.innerText || parent.textContent || '') : '';
        
        if (text.includes('Visualizaciones')) {
          const nums = siblingsText.match(/[\d,.]+\s*mill/gi);
          if (nums && !metrics.visualizaciones) metrics.visualizaciones = nums[0];
        }
        if (text.includes('Espectadores')) {
          const nums = siblingsText.match(/[\d,.]+\s*mill/gi);
          if (nums && !metrics.espectadores) metrics.espectadores = nums[0];
        }
        if (text.includes('Interacciones')) {
          const nums = siblingsText.match(/[\d,.]+\s*mill/gi);
          if (nums && !metrics.interacciones) metrics.interacciones = nums[0];
        }
        if (text.includes('Clics en el enlace')) {
          const nums = siblingsText.match(/[\d,.]+\s*mil/gi);
          if (nums && !metrics.clics_enlace) metrics.clics_enlace = nums[0];
        }
        if (text.includes('Visitas')) {
          const nums = siblingsText.match(/[\d,.]+\s*mill/gi);
          if (nums && !metrics.visitas) metrics.visitas = nums[0];
        }
        if (text.includes('Seguidores')) {
          const nums = siblingsText.match(/[\d,.]+\s*mil/gi);
          if (nums && !metrics.seguidores) metrics.seguidores = nums[0];
        }
        
        // Buscar período
        if ((text.includes('de dic') || text.includes('de ene')) && !metrics.periodo) {
          metrics.periodo = text.substring(0, 50);
        }
      });

      return metrics;
    });

    // Tomar screenshot completo
    const screenshot = await page.screenshot({
      fullPage: true,
      encoding: 'base64'
    });

    await browser.close();

    // Crear respuesta con todos los datos
    const response = {
      success: true,
      data: {
        metrics: metricsJSON,
        screenshot: `data:image/png;base64,${screenshot}`,
        period: facebook_period,
        timestamp: new Date().toISOString()
      }
    };

    // Si se pide guardar localmente
    if (save_locally) {
      const reportsDir = path.join(process.cwd(), 'reports', new Date().toISOString().split('T')[0]);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const timestamp = Date.now();
      
      // Guardar screenshot
      const screenshotPath = path.join(reportsDir, `facebook_screenshot_${timestamp}.png`);
      fs.writeFileSync(screenshotPath, Buffer.from(screenshot, 'base64'));

      // Guardar JSON con métricas
      const metricsPath = path.join(reportsDir, `facebook_metrics_${timestamp}.json`);
      fs.writeFileSync(metricsPath, JSON.stringify(metricsJSON, null, 2));

      response.data.files = {
        screenshot: screenshotPath,
        metrics: metricsPath
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
