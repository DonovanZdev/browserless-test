const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

// Importar las cookies
let cookies = [];
try {
  const cookieFile = fs.readFileSync("tiktok-cookies.json", "utf-8");
  cookies = JSON.parse(cookieFile);
  console.log(`✅ Cargadas ${Array.isArray(cookies) ? cookies.length : Object.keys(cookies).length} cookies`);
} catch (e) {
  console.error("❌ Error cargando cookies:", e.message);
  process.exit(1);
}

// Normalizar cookies
function parseCookies(cookies, domain = '.tiktok.com') {
  if (!cookies) return [];
  
  if (typeof cookies === 'string') {
    try {
      cookies = JSON.parse(cookies);
    } catch (e) {
      console.error('Error parseando cookies:', e.message);
      return [];
    }
  }

  let cookieArray = [];
  
  if (Array.isArray(cookies)) {
    cookieArray = cookies
      .filter(cookie => cookie && cookie.name && cookie.value)
      .map(cookie => {
        const processed = {
          name: String(cookie.name),
          value: String(cookie.value),
          domain: cookie.domain || domain,
          path: cookie.path || '/'
        };
        
        if (cookie.secure !== undefined) processed.secure = Boolean(cookie.secure);
        if (cookie.httpOnly !== undefined) processed.httpOnly = Boolean(cookie.httpOnly);
        if (cookie.expires !== undefined) processed.expires = Number(cookie.expires);
        if (cookie.sameSite) processed.sameSite = String(cookie.sameSite);
        
        return processed;
      });
  } 
  else if (typeof cookies === 'object') {
    cookieArray = Object.entries(cookies)
      .filter(([name, value]) => name && value)
      .map(([name, value]) => ({
        name: String(name),
        value: String(value),
        domain,
        path: '/'
      }));
  }

  console.log(`✅ Parseadas ${cookieArray.length} cookies válidas para ${domain}`);
  return cookieArray;
}

async function testTikTokLogin() {
  console.log("\n========================================");
  console.log("   TEST TIKTOK STUDIO LOGIN");
  console.log("========================================\n");

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const cookieArray = parseCookies(cookies, '.tiktok.com');
  
  console.log("\n🔐 Configurando cookies...");
  await page.setCookie(...cookieArray);

  console.log("\n📍 Navegando a TikTok Studio...");
  const url = `https://www.tiktok.com/tiktokstudio?dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A28%7D&activeAnalyticsMetric=shares`;
  
  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log("✅ Página cargada exitosamente\n");
  } catch (e) {
    console.error("❌ Error al cargar página:", e.message);
    await browser.close();
    process.exit(1);
  }

  // Esperar a que cargue
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Obtener información de la página
  console.log("📊 Analizando contenido de la página...\n");

  const pageInfo = await page.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      isLoggedIn: !window.location.href.includes('login'),
      hasMainContent: !!document.querySelector('[role="main"]'),
      elementCount: document.querySelectorAll('*').length,
      metricCards: document.querySelectorAll('[data-testid*="metric"], [class*="metric"], [role="button"]').length,
      visibleText: document.body.innerText.slice(0, 500),
      // Buscar elementos con números grandes
      largeNumbers: Array.from(document.querySelectorAll('*'))
        .filter(el => /^\d{2,}$/.test(el.innerText?.trim()))
        .slice(0, 10)
        .map(el => ({
          text: el.innerText?.trim(),
          tag: el.tagName,
          class: el.className?.slice(0, 50)
        }))
    };
  });

  console.log("Page Info:");
  console.log("  Título:", pageInfo.title);
  console.log("  URL:", pageInfo.url);
  console.log("  ¿Loggeado?:", pageInfo.isLoggedIn);
  console.log("  ¿Tiene contenido main?:", pageInfo.hasMainContent);
  console.log("  Elementos en DOM:", pageInfo.elementCount);
  console.log("  Tarjetas de métricas encontradas:", pageInfo.metricCards);
  
  console.log("\n📈 Números grandes encontrados en la página:");
  pageInfo.largeNumbers.forEach((num, i) => {
    console.log(`    ${i + 1}. ${num.text} (${num.tag})`);
  });

  // Tomar screenshot
  const screenshotPath = path.join(__dirname, 'tiktok-studio-screenshot.png');
  console.log(`\n📸 Guardando screenshot en: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("✅ Screenshot guardado\n");

  // Intentar extraer el gráfico
  console.log("📍 Buscando gráfico de métricas...");
  const chartInfo = await page.evaluate(() => {
    const circles = document.querySelectorAll('circle[role="presentation"], circle[data-testid], svg circle');
    const rects = document.querySelectorAll('rect[data-testid*="chart"], rect[data-value]');
    const svgs = document.querySelectorAll('svg');
    
    return {
      circles: circles.length,
      rects: rects.length,
      svgs: svgs.length,
      hasChart: svgs.length > 0
    };
  });

  console.log("Gráfico Info:");
  console.log("  Círculos encontrados:", chartInfo.circles);
  console.log("  Rectángulos encontrados:", chartInfo.rects);
  console.log("  SVGs encontrados:", chartInfo.svgs);
  console.log("  ¿Hay gráfico?:", chartInfo.hasChart);

  console.log("\n✅ Test completado. Revisa el archivo 'tiktok-studio-screenshot.png'");

  await browser.close();
}

testTikTokLogin().catch(error => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
