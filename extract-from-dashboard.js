const puppeteer = require("puppeteer-core");
const fs = require("fs");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function extractAllMetricsFromDashboard() {
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  // Navigate to the analytics page (should show all metrics)
  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D`;
  console.log(`📍 Accediendo a dashboard...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Extract the metrics visible on the dashboard
  const metricsData = await page.evaluate(() => {
    const metrics = {};
    
    // Look for metric cards - they usually have a big number and a label
    const cards = document.querySelectorAll('[role="presentation"], div');
    
    // Try to find patterns: Label + Number combinations
    const labels = ['Visualizaciones de videos', 'Visualizaciones de perfil', 'Me gusta', 'Comentarios', 'Veces compartido'];
    
    labels.forEach(label => {
      // Search for this label and nearby numbers
      const elements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent.includes(label)
      );
      
      if (elements.length > 0) {
        // Found the label, now get the big number near it
        const container = elements[0].closest('div') || elements[0];
        const text = container.innerText || '';
        const numbers = text.match(/\d+/g);
        
        if (numbers && numbers.length > 0) {
          const num = parseInt(numbers[0]);
          metrics[label] = num;
        }
      }
    });
    
    return metrics;
  });

  console.log(`\n✅ Métricas encontradas en dashboard:`);
  console.log(JSON.stringify(metricsData, null, 2));
  
  // Now take a screenshot
  await page.screenshot({ path: 'dashboard-full.png' });
  console.log(`\n📸 Screenshot guardado: dashboard-full.png`);

  await browser.close();
}

extractAllMetricsFromDashboard().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
