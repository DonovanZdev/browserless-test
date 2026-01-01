#!/usr/bin/env node

/**
 * Test local del endpoint extract-all-platforms
 * Simula exactamente lo que n8n enviaría
 */

const fs = require('fs');
const path = require('path');

// Mock del req y res
const mockReq = {
  body: JSON.parse(fs.readFileSync(path.join(__dirname, 'n8n-test-payload.json'), 'utf-8'))
};

const mockRes = {
  statusCode: 200,
  json: null,
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    this.json = data;
    return this;
  }
};

// Cargar el endpoint
const handler = require('./api/extract-all-platforms.js');

console.log('🧪 Test: Simulando POST a extract-all-platforms\n');
console.log('📦 Body recibido:');
console.log(`  - cookies: string de ${mockReq.body.cookies.length} caracteres`);
console.log(`  - tiktokCookies: string de ${mockReq.body.tiktokCookies.length} caracteres`);
console.log(`  - period: ${mockReq.body.period}`);
console.log(`  - includeTikTok: ${mockReq.body.includeTikTok}`);
console.log('\n⏳ Procesando...\n');

// Ejecutar handler
handler(mockReq, mockRes).then(() => {
  console.log(`\n✅ Respuesta (status ${mockRes.statusCode}):\n`);
  
  if (mockRes.json && mockRes.json.success) {
    console.log('✅ Éxito! Resultado:');
    console.log(JSON.stringify(mockRes.json, null, 2).substring(0, 500) + '...');
  } else {
    console.log('❌ Error:', mockRes.json);
  }
}).catch(err => {
  console.error('❌ Error:', err.message);
});
