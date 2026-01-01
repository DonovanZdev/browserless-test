const puppeteer = require('puppeteer');
const fs = require('fs');

const TOKEN = process.env.BROWSERLESS_TOKEN || "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

function parseCookies(tiktokCookies, domain = '.tiktok.com') {
  // If it's already an array, return it as is
  if (Array.isArray(tiktokCookies)) {
    return tiktokCookies.map(cookie => ({
      ...cookie,
      domain: domain
    }));
  }
  
  // If it's a string, parse it
  const cookieMap = new Map();
  const pairs = tiktokCookies.split(';').map(pair => pair.trim());
  
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      cookieMap.set(key.trim(), {
        name: key.trim(),
        value: value.trim(),
        domain: domain
      });
    }
  });
  
  return Array.from(cookieMap.values());
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function extractTotalsDebug(tiktokCookies, period = 28) {
  if (!tiktokCookies) {
    throw new Error("TikTok cookies requeridas");
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const cookieArray = parseCookies(tiktokCookies, '.tiktok.com');
  console.log(`Setting ${cookieArray.length} cookies`);
  await page.setCookie(...cookieArray);

  // Navigate to analytics
  const analyticsUrl = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D`;
  
  console.log(`Navigating to ${analyticsUrl}`);
  await page.goto(analyticsUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  await sleep(2000);
  
  const debugInfo = await page.evaluate(() => {
    const result = {};
    const pageText = document.body.innerText;
    const lines = pageText.split('\n').map(l => l.trim());
    
    result.firstLines = lines.slice(0, 50);
    result.totals = {};
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].toLowerCase();
      const nextLine = lines[i + 1];
      const numValue = parseInt(nextLine);
      
      if (!isNaN(numValue) && numValue >= 0) {
        if (currentLine.includes('video') && currentLine.includes('views')) {
          result.totals.visualizaciones_videos = numValue;
        }
        else if (currentLine.includes('profile') && currentLine.includes('views')) {
          result.totals.visualizaciones_perfil = numValue;
        }
        else if (currentLine === 'likes') {
          result.totals.me_gusta = numValue;
        }
        else if (currentLine === 'comments') {
          result.totals.comentarios = numValue;
        }
        else if (currentLine === 'shares') {
          result.totals.veces_compartido = numValue;
        }
      }
    }
    
    return result;
  });

  await browser.close();
  return debugInfo;
}

// Vercel handler
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tiktokCookies } = req.body;
    
    if (!tiktokCookies) {
      return res.status(400).json({ error: 'tiktokCookies required' });
    }

    const debugInfo = await extractTotalsDebug(tiktokCookies, 28);

    return res.status(200).json({
      success: true,
      debugInfo: debugInfo
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
};
