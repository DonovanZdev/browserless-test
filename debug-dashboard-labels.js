const puppeteer = require('puppeteer');
const fs = require('fs');

const COOKIES_FILE = './tiktok-cookies.json';

async function debugDashboard() {
  let browser;
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));

    browser = await puppeteer.launch({
      headless: 'new',
    });

    const page = await browser.newPage();
    await page.setCookie(...cookies);
    
    console.log('📍 Navigating to TikTok Studio...');
    await page.goto('https://www.tiktok.com/tiktokstudio?frame=me', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Capturar el texto de la página
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });

    // Mostrar primeras 2000 caracteres
    console.log('\n📄 DASHBOARD TEXT (first 3000 chars):');
    console.log('='.repeat(80));
    console.log(pageText.substring(0, 3000));
    console.log('='.repeat(80));

    // Buscar líneas que contengan números
    const lines = pageText.split('\n').map(l => l.trim());
    const keyMetricsIndex = lines.findIndex(l => l.includes('Key metrics'));
    
    console.log(`\n🔍 Key metrics found at index: ${keyMetricsIndex}`);
    
    if (keyMetricsIndex !== -1) {
      console.log('\n📊 METRICS SECTION:');
      for (let i = Math.max(0, keyMetricsIndex - 2); i < Math.min(lines.length, keyMetricsIndex + 20); i++) {
        console.log(`[${i}] ${lines[i]}`);
      }
    }

    // Buscar líneas con números
    console.log('\n🔢 LINES WITH NUMBERS:');
    lines.forEach((line, idx) => {
      if (/\d+/.test(line) && line.length < 100) {
        console.log(`[${idx}] ${line}`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

debugDashboard();
