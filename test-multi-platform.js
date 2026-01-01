const extract = require('./api/extract-all-platforms.js');
const fs = require('fs');

const fbCookies = JSON.parse(fs.readFileSync('fb-cookies.json', 'utf8'));
const tiktokCookies = (() => {
  try {
    return JSON.parse(fs.readFileSync('tiktok-cookies.json', 'utf8'));
  } catch (e) {
    console.warn('⚠️ TikTok cookies no encontradas, omitiendo TikTok');
    return null;
  }
})();

(async () => {
  const req = { 
    body: { 
      cookies: fbCookies,
      tiktokCookies: tiktokCookies,
      period: 'LAST_28D',
      includeTikTok: true  // ✅ HABILITADO
    },
    method: 'POST'
  };
  
  let result = null;
  const res = {
    status: (code) => {
      return {
        json: (data) => {
          result = { code, data };
        }
      };
    },
    json: (data) => {
      result = { code: 200, data };
    }
  };
  
  console.log('\n========================================');
  console.log('   EXTRACCIÓN MULTI-PLATAFORMA');
  console.log('========================================\n');
  
  await extract(req, res);
  
  // Guardar resultado en JSON
  const outputPath = `reports/multi-platform-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2));
  
  console.log(`\n📁 Resultado guardado en: ${outputPath}`);
  
  // Mostrar resumen
  if (result.data.data.platforms.facebook) {
    const fb = result.data.data.platforms.facebook;
    console.log('\n📊 Facebook:');
    console.log(`   Total de métricas: ${Object.keys(fb.metrics || {}).length}`);
    if (fb.metrics.Visualizaciones) {
      console.log(`   Puntos de datos: ${fb.metrics.Visualizaciones.totalPoints}`);
    }
  }
  
  if (result.data.data.platforms.instagram) {
    const ig = result.data.data.platforms.instagram;
    console.log('\n📷 Instagram:');
    console.log(`   Total de métricas: ${Object.keys(ig.metrics || {}).length}`);
    if (ig.metrics.Visualizaciones) {
      console.log(`   Puntos de datos: ${ig.metrics.Visualizaciones.totalPoints}`);
    }
  }

  if (result.data.data.platforms.tiktok) {
    const tk = result.data.data.platforms.tiktok;
    if (!tk.error) {
      console.log('\n🎵 TikTok:');
      console.log(`   Datos: ${JSON.stringify(tk, null, 2)}`);
    } else {
      console.log('\n🎵 TikTok: ❌ ' + tk.error);
    }
  }
  
  console.log('\n========================================\n');
})();
