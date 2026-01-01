/**
 * Script para iniciar sesión en TikTok y guardar cookies localmente
 * 
 * USAGE:
 * node save-tiktok-cookies.js
 * 
 * Se abrirá un navegador, debes iniciar sesión manualmente
 * Las cookies se guardarán en tiktok-cookies.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'tiktok-cookies.json');

(async () => {
  let browser;
  try {
    console.log('🚀 Abriendo navegador...');
    browser = await puppeteer.launch({
      headless: false, // Mostrar interfaz gráfica
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Establecer user agent para TikTok
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Establecer viewport
    await page.setViewport({ width: 1280, height: 720 });

    console.log('📱 Navegando a TikTok Studio...');
    await page.goto('https://www.tiktok.com/creator', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    console.log('⏳ Esperando a que inicies sesión manualmente...');
    console.log('📌 Por favor, inicia sesión en la ventana del navegador');
    console.log('⚠️  NO CIERRES EL NAVEGADOR mientras estés iniciando sesión');
    console.log('💡 Si se abre un modal de login, complétalo en el navegador');

    // Esperar hasta que se cargue la página de studio (máximo 5 minutos)
    let sessionActive = false;
    let attempts = 0;
    
    while (!sessionActive && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      
      try {
        // Verificar si estamos en la página de studio (indicador de login exitoso)
        const url = page.url();
        if (url.includes('tiktok.com/creator') && !url.includes('login')) {
          sessionActive = true;
          console.log('✅ Sesión detectada!');
          break;
        }
      } catch (e) {
        // Continuar intentando
      }
      
      attempts++;
      if (attempts % 12 === 0) { // Cada 60 segundos
        console.log(`⏱️  Esperando... (${attempts * 5}s)`);
      }
    }

    if (!sessionActive) {
      console.log('⚠️  Timeout esperando sesión, pero continuaremos de todas formas...');
    }

    console.log('✅ Extrayendo cookies...');

    // Obtener todas las cookies
    const cookies = await page.cookies();

    if (cookies.length === 0) {
      console.warn('⚠️  No se encontraron cookies. Asegúrate de haber iniciado sesión correctamente.');
    }

    // Guardar cookies en archivo JSON
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`✅ Cookies guardadas en: ${COOKIES_FILE}`);
    console.log(`📊 Total de cookies: ${cookies.length}`);

    // Mostrar info de algunas cookies
    if (cookies.length > 0) {
      console.log('\n📋 Cookies principales guardadas:');
      cookies.slice(0, 5).forEach(cookie => {
        console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
      });
    }

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
