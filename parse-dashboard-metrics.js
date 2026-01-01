const puppeteer = require("puppeteer-core");
const fs = require("fs");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function extractAllMetricsFromMainPage() {
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

  // Extract all metrics with their graphs
  const metrics = await page.evaluate(() => {
    const result = {};
    const pageText = document.body.innerText;
    
    // Find the "Key metrics" section
    const lines = pageText.split('\n').map(l => l.trim());
    const keyMetricsIndex = lines.findIndex(l => l.includes('Key metrics'));
    
    if (keyMetricsIndex === -1) {
      return result; // Key metrics section not found
    }
    
    // Extract only from the Key metrics section
    // Get lines from Key metrics to the next main section (usually "Est. rewards" or end)
    const metricsSection = [];
    for (let i = keyMetricsIndex; i < lines.length; i++) {
      if (i > keyMetricsIndex && (lines[i].includes('rewards') || lines[i].includes('Monetization'))) {
        break;
      }
      metricsSection.push(lines[i]);
    }
    
    const metricsText = metricsSection.join('\n');
    
    // Key metric names to look for (only look in metrics section)
    const metricPatterns = [
      { key: 'visualizaciones_videos', label: 'Video views' },
      { key: 'visualizaciones_perfil', label: 'Profile views' },
      { key: 'me_gusta', label: 'Likes' },
      { key: 'comentarios', label: 'Comments' },
      { key: 'veces_compartido', label: 'Shares' }
    ];
    
    metricPatterns.forEach(metric => {
      // Find the label in the metrics section text
      const regex = new RegExp(`${metric.label}\\s+(\\d+)`, 'i');
      const match = metricsText.match(regex);
      
      if (match) {
        result[metric.key] = parseInt(match[1]);
      }
    });
    
    return result;
  });

  console.log(`\n✅ Métricas extraídas del dashboard:`);
  Object.entries(metrics).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  await browser.close();
}

extractAllMetricsFromMainPage().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
