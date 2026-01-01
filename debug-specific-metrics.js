const puppeteer = require("puppeteer-core");
const fs = require("fs");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function debugMetric() {
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  const metrics = [
    { name: 'Visualizaciones de videos v1', param: 'video_views' },
    { name: 'Visualizaciones de videos v2', param: 'videoviews' },
    { name: 'Me gusta v1', param: 'likes' },
    { name: 'Perfil (working)', param: 'profile_views' }
  ];

  for (const metric of metrics) {
    console.log(`\n🔍 ${metric.name} (${metric.param}):`);
    
    const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D&activeAnalyticsMetric=${metric.param}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait longer and try to scroll to trigger loading
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 1000));
    
    // Extraer números y texto
    const data = await page.evaluate(() => {
      const numbers = [];
      
      document.querySelectorAll('*').forEach(el => {
        const text = el.innerText?.trim();
        if (text && /^\d+$/.test(text)) {
          const num = parseInt(text);
          if (num >= 0 && num < 999999) numbers.push(num);
        }
      });
      
      // Buscar específicamente la tarjeta de métricas
      const metricsText = [];
      document.querySelectorAll('[role="main"], main, article').forEach(el => {
        const text = el.innerText || '';
        if (text.length > 20 && text.length < 2000) {
          metricsText.push(text);
        }
      });
      
      return {
        numbers: [...new Set(numbers)].sort((a, b) => b - a),
        metricsText: metricsText.slice(0, 3) // First 3 relevant sections
      };
    });
    
    console.log(`  Números encontrados: ${data.numbers.slice(0, 10).join(', ')}`);
    if (data.metricsText.length > 0) {
      console.log(`  Texto de métricas:`);
      data.metricsText.forEach((section, idx) => {
        console.log(`    [Sección ${idx}]: ${section.substring(0, 120)}...`);
      });
    }
  }

  await browser.close();
}

debugMetric().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
