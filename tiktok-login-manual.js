const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');

puppeteer.use(StealthPlugin());

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  try {
    console.log('🚀 Lanzando navegador...');
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('📍 Navegando a TikTok Studio...');
    await page.goto('https://www.tiktok.com/tiktokstudio', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n📱 Se abrió el navegador. Por favor:');
    console.log('1. Inicia sesión manualmente');
    console.log('2. Accede a TikTok Studio');
    console.log('3. Cuando estés en el dashboard, presiona Enter en esta terminal\n');

    // Esperar a que el usuario presione Enter
    await new Promise(resolve => {
      rl.question('Presiona Enter cuando hayas iniciado sesión: ', () => {
        resolve();
      });
    });

    console.log('\n🍪 Extrayendo cookies...');
    const cookies = await page.cookies();
    
    const cookiesObj = {};
    cookies.forEach(cookie => {
      cookiesObj[cookie.name] = cookie.value;
    });

    // Guardar
    fs.writeFileSync('tiktok-cookies.json', JSON.stringify(cookiesObj, null, 2));
    
    console.log('✅ Cookies guardadas en tiktok-cookies.json');
    console.log(`✅ Total de cookies: ${Object.keys(cookiesObj).length}`);
    
    console.log('\n📋 Principales:');
    const important = Object.keys(cookiesObj).filter(k => 
      k.includes('session') || k.includes('token') || k.includes('passport')
    );
    important.forEach(k => console.log(`  - ${k}`));

    rl.close();
    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
})();
