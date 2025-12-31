const puppeteer = require("puppeteer-core");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function main() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();

  await page.goto("https://www.example.com/", { waitUntil: "networkidle2" });

  const title = await page.title();
  console.log("Título de la página:", title);

  await browser.close();
}

main().catch(console.error);
