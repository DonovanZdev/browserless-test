const puppeteer = require('puppeteer');
const fs = require('fs');

const COOKIES_FILE = './tiktok-cookies-converted.json';

async function testTotalExtraction() {
  let browser;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

    // Try with puppeteer-core + browserless
    try {
      const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
      });
    } catch (e) {
      // Fallback to local puppeteer
      browser = await puppeteer.launch({
        headless: 'new',
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setCookie(...cookies);
    
    const period = 28;
    const analyticsUrl = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D`;
    
    console.log('📍 Navegando a analytics...');
    await page.goto(analyticsUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 2000));

    const totals = await page.evaluate(() => {
      const result = {};
      const pageText = document.body.innerText;
      const lines = pageText.split('\n').map(l => l.trim());
      
      console.log(`Total lines: ${lines.length}`);
      
      for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i].toLowerCase();
        const nextLine = lines[i + 1];
        const numValue = parseInt(nextLine);
        
        if (!isNaN(numValue) && numValue >= 0) {
          if (currentLine.includes('video') && currentLine.includes('views')) {
            result.visualizaciones_videos = numValue;
            console.log(`Found Video views: ${numValue}`);
          }
          else if (currentLine.includes('profile') && currentLine.includes('views')) {
            result.visualizaciones_perfil = numValue;
            console.log(`Found Profile views: ${numValue}`);
          }
          else if (currentLine === 'likes') {
            result.me_gusta = numValue;
            console.log(`Found Likes: ${numValue}`);
          }
          else if (currentLine === 'comments') {
            result.comentarios = numValue;
            console.log(`Found Comments: ${numValue}`);
          }
          else if (currentLine === 'shares') {
            result.veces_compartido = numValue;
            console.log(`Found Shares: ${numValue}`);
          }
        }
      }
      
      return result;
    });

    console.log('\n✅ TOTALES EXTRAÍDOS:');
    console.log(JSON.stringify(totals, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

testTotalExtraction();
