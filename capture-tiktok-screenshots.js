const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function captureMetricScreenshots() {
  console.log("\n========================================");
  console.log("   CAPTURANDO SCREENSHOTS POR MÉTRICA");
  console.log("========================================\n");

  // Cargar cookies
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D&activeAnalyticsMetric=shares`;
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 3000));

  const metrics = [
    { label: 'Visualizaciones de videos', param: 'video_views' },
    { label: 'Visualizaciones de perfil', param: 'profile_views' },
    { label: 'Me gusta', param: 'likes' },
    { label: 'Comentarios', param: 'comments' },
    { label: 'Veces compartido', param: 'shares' }
  ];

  for (const metric of metrics) {
    console.log(`📷 Capturando: ${metric.label}`);
    
    // Navegar a la URL con el parámetro de métrica
    const metricUrl = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D&activeAnalyticsMetric=${metric.param}`;
    await page.goto(metricUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 1500));

    // Tomar screenshot
    const filename = metric.label.toLowerCase().replace(/\s+/g, '-');
    const filepath = path.join(__dirname, `screenshot-${filename}.png`);
    await page.screenshot({ path: filepath });
    console.log(`  ✅ Guardado: screenshot-${filename}.png\n`);
  }

  await browser.close();
  console.log("✅ Screenshots capturadas en el directorio actual");
}

captureMetricScreenshots().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
