/**
 * Script para iniciar sesión en Facebook y guardar cookies localmente
 * 
 * USAGE:
 * node save-facebook-cookies.js
 * 
 * Se abrirá un navegador, debes iniciar sesión manualmente
 * Las cookies se guardarán en facebook-cookies.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'facebook-cookies.json');

(async () => {
  let browser;
  try {
    console.log('🚀 Abriendo navegador...');
    browser = await puppeteer.launch({
      headless: false, // Mostrar interfaz gráfica
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Establecer viewport
    await page.setViewport({ width: 1280, height: 720 });

    console.log('📱 Navegando a Facebook...');
    await page.goto('https://www.facebook.com/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('⏳ Esperando a que inicies sesión manualmente...');
    console.log('📌 Por favor, inicia sesión en la ventana del navegador');
    console.log('⚠️  NO CIERRES EL NAVEGADOR mientras estés iniciando sesión');

    // Esperar hasta que la URL cambie (indicando login exitoso)
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 300000 }).catch(() => {
      console.log('⏱️  Timeout esperando navegación, continuando...');
    });

    console.log('✅ Sesión iniciada. Extrayendo cookies...');

    // Obtener todas las cookies
    const cookies = await page.cookies();

    // Guardar cookies en archivo JSON
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`✅ Cookies guardadas en: ${COOKIES_FILE}`);
    console.log(`📊 Total de cookies: ${cookies.length}`);

    // Mostrar info de algunas cookies
    console.log('\n📋 Cookies principales guardadas:');
    cookies.slice(0, 5).forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });

    console.log('\n✨ ¡Listo! Puedes cerrar el navegador.');
    console.log(`📁 Cookies guardadas en: ${path.relative(process.cwd(), COOKIES_FILE)}`);

    // Esperar 5 segundos antes de cerrar para que el usuario vea el mensaje
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
