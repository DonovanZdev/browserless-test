const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function testSessionValidity() {
  console.log("\n========================================");
  console.log("   TEST SESSION VALIDITY");
  console.log("========================================\n");

  // Cargar cookies
  const cookies = JSON.parse(fs.readFileSync("tiktok-cookies-converted.json", "utf-8"));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log("🔐 Configurando cookies...");
  await page.setCookie(...cookies);

  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D&activeAnalyticsMetric=shares`;
  
  console.log("📍 Navegando a TikTok Studio...");
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 3000));

  // Verificar sesión
  const sessionData = await page.evaluate(() => {
    return {
      title: document.title,
      isLoggedIn: !window.location.href.includes('login'),
      hasContent: document.querySelector('[role="main"]') !== null,
      url: window.location.href,
      // Buscar números grandes (métricas)
      metrics: Array.from(document.querySelectorAll('span, div'))
        .filter(el => /^[\d,]+$/.test(el.innerText?.trim()))
        .map(el => el.innerText?.trim())
        .filter((val, idx, arr) => arr.indexOf(val) === idx)
        .slice(0, 20)
    };
  });

  console.log("\n📊 Session Data:");
  console.log("  Title:", sessionData.title);
  console.log("  Logged in:", sessionData.isLoggedIn);
  console.log("  Has content:", sessionData.hasContent);
  console.log("  URL:", sessionData.url.slice(0, 80) + "...");
  
  console.log("\n📈 Números encontrados en la página:");
  if (sessionData.metrics.length > 0) {
    sessionData.metrics.forEach(num => console.log("    -", num));
  } else {
    console.log("    (Ninguno encontrado)");
  }

  // Intenta hacer click en una métrica
  console.log("\n🖱️  Intentando clickear en 'Visualizaciones de videos'...");
  const clickResult = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent.includes('Visualizaciones de videos')
    );
    
    console.log("Elementos encontrados:", elements.length);
    
    if (elements.length > 0) {
      elements[0].click();
      return true;
    }
    return false;
  });

  console.log("  Click result:", clickResult ? "✅ Success" : "❌ No element found");

  await new Promise(r => setTimeout(r, 2000));

  // Buscar gráfico
  const chartData = await page.evaluate(() => {
    const circles = document.querySelectorAll('circle');
    const values = [];
    
    circles.forEach(circle => {
      const dataValue = circle.getAttribute('data-value');
      if (dataValue) {
        const match = dataValue.match(/\d+/);
        if (match) values.push(parseInt(match[0]));
      }
    });
    
    return {
      circlesFound: circles.length,
      valuesExtracted: values.slice(0, 10),
      hasData: values.length > 0
    };
  });

  console.log("\n📊 Gráfico:");
  console.log("  Círculos encontrados:", chartData.circlesFound);
  console.log("  Valores extraídos:", chartData.valuesExtracted.join(", ") || "Ninguno");
  console.log("  ¿Hay datos?:", chartData.hasData ? "✅ Sí" : "❌ No");

  if (!chartData.hasData) {
    console.log("\n⚠️  Las cookies pueden estar expiradas. Genera nuevas cookies accediendo a:");
    console.log("   https://www.tiktok.com/tiktokstudio");
  }

  // Guardar screenshot
  console.log("\n📸 Guardando screenshot...");
  await page.screenshot({ path: 'tiktok-test-result.png', fullPage: true });
  console.log("✅ Guardado como: tiktok-test-result.png");

  await browser.close();
}

testSessionValidity().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
