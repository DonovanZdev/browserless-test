const puppeteer = require("puppeteer-core");
const fs = require("fs");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function extractMetricsSimple() {
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D`;
  console.log(`📍 Navigating to dashboard...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  await new Promise(r => setTimeout(r, 3000));

  // Use pure text extraction
  const metrics = await page.evaluate(() => {
    const pageText = document.body.innerText;
    const lines = pageText.split('\n');
    
    // Log first 50 lines to understand structure
    return lines.slice(10, 50);
  });

  console.log(`📄 Dashboard text (lines 10-50):`);
  metrics.forEach((line, idx) => {
    console.log(`  ${line}`);
  });

  await browser.close();
}

extractMetricsSimple().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
