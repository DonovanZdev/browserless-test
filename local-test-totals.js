const fs = require('fs');

// Import the functions directly (can't easily do this with modules)
// Instead, let's create a simpler test

const puppeteer = require('puppeteer');

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const COOKIES_FILE = './tiktok-cookies-converted.json';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function extractTotalsFromDashboard(page, period) {
  const analyticsUrl = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D`;
  
  console.log('  📊 Navegando a analytics...');
  await page.goto(analyticsUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  await sleep(2000);
  
  const totals = await page.evaluate(() => {
    const result = {};
    const pageText = document.body.innerText;
    const lines = pageText.split('\n').map(l => l.trim());
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].toLowerCase();
      const nextLine = lines[i + 1];
      const numValue = parseInt(nextLine);
      
      if (!isNaN(numValue) && numValue >= 0) {
        if (currentLine.includes('video') && currentLine.includes('views')) {
          result.visualizaciones_videos = numValue;
        }
        else if (currentLine.includes('profile') && currentLine.includes('views')) {
          result.visualizaciones_perfil = numValue;
        }
        else if (currentLine === 'likes') {
          result.me_gusta = numValue;
        }
        else if (currentLine === 'comments') {
          result.comentarios = numValue;
        }
        else if (currentLine === 'shares') {
          result.veces_compartido = numValue;
        }
      }
    }
    
    return result;
  });

  return totals;
}

async function testExtraction() {
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCookie(...cookies);
  
  const period = 28;
  
  console.log('🔄 Extrayendo totales...');
  const totals = await extractTotalsFromDashboard(page, period);
  
  console.log('\n✅ TOTALES EXTRAÍDOS:');
  console.log(JSON.stringify(totals, null, 2));
  
  await browser.close();
}

testExtraction().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
