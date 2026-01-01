const puppeteer = require("puppeteer-core");
const fs = require("fs");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function debugAnalytics() {
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  const url = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D`;
  console.log(`📍 Navigating to analytics...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  await new Promise(r => setTimeout(r, 3000));

  // Extract the header text to see metric names and values
  const headerText = await page.evaluate(() => {
    return document.body.innerText.substring(0, 2000);
  });

  console.log(`\n📄 ANALYTICS HEADER TEXT (first 2000 chars):`);
  console.log('='.repeat(80));
  console.log(headerText);
  console.log('='.repeat(80));

  // Also get line by line to find metric patterns
  const lines = await page.evaluate(() => {
    const pageText = document.body.innerText;
    return pageText.split('\n').map(l => l.trim());
  });

  console.log(`\n📊 FIRST 40 LINES:`);
  for (let i = 0; i < Math.min(40, lines.length); i++) {
    console.log(`[${i}] ${lines[i]}`);
  }

  await browser.close();
}

debugAnalytics().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
