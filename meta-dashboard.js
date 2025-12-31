const puppeteer = require("puppeteer-core");
const fs = require("fs/promises");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Leer cookies de variable de entorno o archivo local
  let cookies;
  if (process.env.FB_COOKIES) {
    try {
      cookies = JSON.parse(process.env.FB_COOKIES);
      console.log("✓ Cookies cargadas desde variable de entorno");
    } catch (e) {
      console.error("Error al parsear FB_COOKIES:", e.message);
      process.exit(1);
    }
  } else {
    try {
      cookies = JSON.parse(await fs.readFile("fb-cookies.json", "utf8"));
      console.log("✓ Cookies cargadas desde archivo local");
    } catch (e) {
      console.error("Error: No se encontró FB_COOKIES ni fb-cookies.json");
      process.exit(1);
    }
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  
  // Aumentar el viewport para ver toda la página
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.setCookie(...cookies);

  await page.goto("https://business.facebook.com/latest/insights/overview?business_id=176166689688823&asset_id=8555156748&time_range=%257B%2522end%2522%253A%25222025-12-03%2522%252C%2522start%2522%253A%25222025-12-03%2522%257D", {
    waitUntil: "networkidle2",
  });

  console.log("Título inicial:", await page.title());
  await sleep(2000);
  
  // Presionar ESC dos veces para cerrar ambos modales
  console.log("Cerrando modales con ESC...");
  await page.keyboard.press('Escape');
  await sleep(800);
  await page.keyboard.press('Escape');
  await sleep(1500);
  
  console.log("Modales cerrados");
  
  // Scrollear para cargar todo el contenido
  await page.evaluate(() => {
    window.scrollBy(0, window.innerHeight * 3);
  });
  await sleep(2000);

  // Extraer datos de Rendimiento
  console.log("\n=== EXTRAYENDO DATOS DE RENDIMIENTO ===\n");
  
  const rendimientoData = await page.evaluate(() => {
    const data = {};
    
    // Obtener todos los textos con números y "mill"
    const allText = document.body.innerText;
    
    // Visualizaciones
    const vizMatch = allText.match(/Visualizaciones[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (vizMatch) data.visualizaciones = vizMatch[1];
    
    // Interacciones con el contenido
    const intMatch = allText.match(/Interacciones con el contenido[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (intMatch) data.interacciones = intMatch[1];
    
    // Visitas de Facebook
    const visitMatch = allText.match(/Visitas de Facebook[\s\S]*?(\d+[\.,]\d+\s*mill\.?)/);
    if (visitMatch) data.visitas = visitMatch[1];
    
    // Seguidores (puede ser "mil" o "mill")
    const followMatch = allText.match(/Seguidores[\s\S]*?(\d+[\s,]*\d*\s*mil[l]?\.?)/);
    if (followMatch) data.seguimientos = followMatch[1];
    
    return data;
  });
  
  console.log("Datos extraídos:");
  console.log(JSON.stringify(rendimientoData, null, 2));
  
  // Guardar datos en archivo
  await fs.writeFile("rendimiento-data.json", JSON.stringify(rendimientoData, null, 2));
  console.log("\n✓ Datos guardados en rendimiento-data.json");

  await page.screenshot({ path: "meta-dashboard.png", fullPage: true });
  console.log("Screenshot guardado como meta-dashboard.png");

  await browser.close();
}

main().catch((err) => {
  console.error("Error en el script:", err);
});