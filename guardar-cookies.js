const puppeteer = require("puppeteer");
const fs = require("fs/promises");

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // para que puedas ver el login
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle2" });

  console.log("Inicia sesión manualmente y espera a que cargue Facebook/Business Suite...");

  // Espera a que termines (puedes dar ENTER en la terminal cuando ya veas tu inicio)
  process.stdin.once("data", async () => {
    const cookies = await page.cookies();
    await fs.writeFile("fb-cookies.json", JSON.stringify(cookies, null, 2));
    console.log("Cookies guardadas en fb-cookies.json");
    await browser.close();
    process.exit(0);
  });
})();