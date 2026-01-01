#!/usr/bin/env node

/**
 * Script para normalizar cookies para n8n
 * Convierte ambas cookies al formato que n8n espera
 */

const fs = require('fs');
const path = require('path');

function normalizeCookiesForN8n() {
  console.log('📦 Normalizando cookies para n8n...\n');
  
  // Leer Facebook cookies
  const fbCookiesPath = path.join(__dirname, 'fb-cookies.json');
  const fbCookies = JSON.parse(fs.readFileSync(fbCookiesPath, 'utf-8'));
  
  console.log('Facebook cookies:');
  console.log(`  - Tipo: ${Array.isArray(fbCookies) ? 'Array' : typeof fbCookies}`);
  console.log(`  - Longitud: ${Array.isArray(fbCookies) ? fbCookies.length : Object.keys(fbCookies).length}`);
  if (Array.isArray(fbCookies)) {
    console.log(`  - Primer elemento: ${Object.keys(fbCookies[0]).join(', ')}`);
  }
  
  // Leer TikTok cookies
  const tiktokCookiesPath = path.join(__dirname, 'tiktok-cookies.json');
  const tiktokCookiesRaw = JSON.parse(fs.readFileSync(tiktokCookiesPath, 'utf-8'));
  
  console.log('\nTikTok cookies (raw):');
  console.log(`  - Tipo: ${Array.isArray(tiktokCookiesRaw) ? 'Array' : typeof tiktokCookiesRaw}`);
  
  // Procesar TikTok cookies
  let tiktokCookies = tiktokCookiesRaw;
  if (Array.isArray(tiktokCookiesRaw) && tiktokCookiesRaw.length === 1) {
    // Si es array con 1 elemento, extraer el objeto
    tiktokCookies = tiktokCookiesRaw[0];
    console.log(`  - Extraído: Objeto con ${Object.keys(tiktokCookies).length} campos`);
  }
  
  // ✅ OPCIÓN 1: Ambas como strings (lo que n8n hace automáticamente)
  const fbCookiesString = JSON.stringify(fbCookies);
  const tiktokCookiesString = JSON.stringify(tiktokCookies);
  
  // ✅ OPCIÓN 2: Guardar como JSON minificado para copiar-pegar
  const n8nFormat = {
    meta_cookies_n8n: fbCookiesString,
    tiktok_cookies_n8n: tiktokCookiesString,
    // Info de debug
    _info: {
      facebook_count: Array.isArray(fbCookies) ? fbCookies.length : Object.keys(fbCookies).length,
      tiktok_count: typeof tiktokCookies === 'object' ? Object.keys(tiktokCookies).length : 'unknown'
    }
  };
  
  // Guardar archivo de configuración para n8n
  const outputPath = path.join(__dirname, 'n8n-cookies-config.json');
  fs.writeFileSync(outputPath, JSON.stringify(n8nFormat, null, 2));
  
  console.log('\n✅ Archivo n8n-cookies-config.json creado');
  console.log('\n📋 Usa estos valores en n8n Set nodes:\n');
  
  // Mostrar versión minificada para copiar
  console.log('Facebook cookies (minificado):');
  console.log('================================');
  console.log(fbCookiesString);
  console.log('\n\nTikTok cookies (minificado):');
  console.log('============================');
  console.log(tiktokCookiesString);
  console.log('\n');
  
  // Test: crear payload de ejemplo
  const testPayload = {
    cookies: fbCookiesString,
    tiktokCookies: tiktokCookiesString,
    period: 'LAST_28D',
    includeTikTok: true,
    businessId: '176166689688823',
    assetId: '8555156748'
  };
  
  const testPayloadPath = path.join(__dirname, 'n8n-test-payload.json');
  fs.writeFileSync(testPayloadPath, JSON.stringify(testPayload, null, 2));
  
  console.log('✅ Archivo n8n-test-payload.json creado');
  console.log('\nPara probar localmente, usa:');
  console.log('curl -X POST http://localhost:3000/api/extract-all-platforms \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d @n8n-test-payload.json');
}

normalizeCookiesForN8n();
