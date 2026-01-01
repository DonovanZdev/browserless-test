/**
 * Script para convertir cookies JSON a diferentes formatos para usar en n8n
 * 
 * USAGE:
 * node convert-cookies.js facebook
 * node convert-cookies.js tiktok
 * node convert-cookies.js instagram
 */

const fs = require('fs');
const path = require('path');

const platform = process.argv[2] || 'facebook';
const cookiesFile = path.join(__dirname, `${platform}-cookies.json`);

if (!fs.existsSync(cookiesFile)) {
  console.error(`❌ No se encontró: ${cookiesFile}`);
  process.exit(1);
}

const cookies = JSON.parse(fs.readFileSync(cookiesFile, 'utf-8'));

console.log(`\n✅ Cookies de ${platform.toUpperCase()} convertidas:\n`);

// Formato 1: Array JSON (para copiar directo en n8n)
console.log('📋 FORMATO 1 - Para usar en n8n (sin comillas):');
console.log('================================================');
console.log('Copia esto en tu Body del HTTP Request (SIN comillas):');
console.log('\n"cookies": ' + JSON.stringify(cookies));

// Formato 2: Objeto simple para verificación
console.log('\n\n📋 FORMATO 2 - Para copiar como string (con comillas):');
console.log('================================================');
console.log('Si necesitas como string, copia esto:');
console.log('\n"cookies": "' + JSON.stringify(cookies).replace(/"/g, '\\"') + '"');

// Formato 3: Mostrar cookies individuales
console.log('\n\n📋 FORMATO 3 - Cookies individuales:');
console.log('================================================');
cookies.slice(0, 5).forEach(cookie => {
  console.log(`- ${cookie.name}: ${cookie.value.substring(0, 60)}...`);
});
console.log(`\n... y ${cookies.length - 5} cookies más\n`);

// Guardar en archivo para fácil acceso
const outputFile = path.join(__dirname, `${platform}-cookies-formatted.json`);
fs.writeFileSync(outputFile, JSON.stringify(cookies, null, 2));
console.log(`📁 Cookies guardadas también en: ${outputFile}`);
