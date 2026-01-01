const axios = require('axios');
const fs = require('fs');

// Test payload with valid cookies
const testPayload = require('./n8n-cookies-config.json');

const API_URL = 'http://localhost:3000/api/extract-tiktok';
const VERCEL_URL = 'https://browserless-test.vercel.app/api/extract-tiktok';

async function debugDOMStructure() {
  try {
    console.log('\n📍 DEBUG: Enviando request para analizar DOM...\n');

    // Solo hacer una llamada para ver qué se extrae
    const payload = {
      tiktokCookies: testPayload.tiktokCookies,
      period: 'LAST_28D',
      debug: true  // Si existe, mostrar info de debug
    };

    const response = await axios.post(VERCEL_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });

    console.log('✅ Response Status:', response.status);
    console.log('\n📊 Datos recibidos:');
    
    if (response.data && response.data.metrics) {
      Object.entries(response.data.metrics).forEach(([metric, data]) => {
        console.log(`\n  ${metric}:`);
        console.log(`    Total: ${data.total}`);
        console.log(`    Puntos: ${data.historical?.length || 0}`);
        if (data.historical && data.historical.length > 0) {
          console.log(`    Primeros 5 días: ${data.historical.slice(0, 5).map(d => d.valor).join(', ')}`);
        }
      });
    }

    // Guardar respuesta completa para análisis
    fs.writeFileSync('debug-response.json', JSON.stringify(response.data, null, 2));
    console.log('\n✅ Respuesta completa guardada en debug-response.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugDOMStructure();
