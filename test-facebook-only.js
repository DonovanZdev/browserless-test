const fs = require('fs');
const path = require('path');

// Leer cookies de Facebook
const fbCookiesPath = path.join(__dirname, 'fb-cookies.json');

if (!fs.existsSync(fbCookiesPath)) {
  console.error('❌ fb-cookies.json no encontrado. Ejecuta guardar-cookies.js primero.');
  process.exit(1);
}

const fbCookies = JSON.parse(fs.readFileSync(fbCookiesPath, 'utf8'));

// Hacer request al endpoint
const testData = {
  meta_cookies: fbCookies,
  platform: 'facebook',
  facebook_period: 'THIS_MONTH' // Opciones: 'THIS_MONTH', 'LAST_28D', 'LAST_7D', etc.
};

console.log('📱 Probando extracción de métricas de Facebook...');
console.log('URL: http://localhost:3000/api/extract');
console.log('Cookies cargadas:', fbCookies.length, 'cookies');
console.log('---');

// Simular el handler localmente
const handler = require('./api/extract.js');

// Crear mock de req y res
const req = {
  method: 'POST',
  body: testData
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log('\n✅ Respuesta del servidor:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data.facebook) {
      console.log('\n📊 Métricas de Facebook extraídas:');
      const fb = data.data.facebook;
      console.log('  Visualizaciones:', fb.visualizaciones);
      console.log('  Espectadores:', fb.espectadores);
      console.log('  Interacciones:', fb.interacciones);
      console.log('  Clics enlace:', fb.clics_enlace);
      console.log('  Visitas:', fb.visitas);
      console.log('  Seguidores:', fb.seguidores);
      console.log('  Período:', fb.periodo);
    }
  }
};

handler(req, res).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
