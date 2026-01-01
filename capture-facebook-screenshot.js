const fs = require('fs');
const path = require('path');
const puppeteer = require("puppeteer-core");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshot() {
  const fbCookiesPath = path.join(__dirname, 'fb-cookies.json');
  const fbCookies = JSON.parse(fs.readFileSync(fbCookiesPath, 'utf8'));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Usar cookies directamente (ya están en formato correcto)
  await page.setCookie(...fbCookies);

  const url = "https://business.facebook.com/latest/insights/results?business_id=176166689688823&asset_id=8555156748&time_range=%2522LAST_28D%2522&platform=Facebook&audience_tab=demographics";
  
  await page.goto(url, { waitUntil: "networkidle2" });
  await sleep(2000);
  
  await page.keyboard.press('Escape');
  await sleep(800);
  await page.keyboard.press('Escape');
  await sleep(1500);
  
  // Esperar a que la página esté completamente renderizada
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: 10000 });

  const screenshotBuffer = await page.screenshot({ fullPage: true });
  await browser.close();
  
  fs.writeFileSync('facebook-screenshot.png', screenshotBuffer);
  console.log('✅ Screenshot guardado en facebook-screenshot.png');
}

captureScreenshot().catch(console.error);
