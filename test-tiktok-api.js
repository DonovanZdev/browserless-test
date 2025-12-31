const fs = require('fs');

const tiktokCookies = JSON.parse(fs.readFileSync('tiktok-cookies.json', 'utf8'));
const metaCookies = JSON.parse(fs.readFileSync('fb-cookies.json', 'utf8'));

const payload = {
  meta_cookies: metaCookies,
  tiktok_cookies: tiktokCookies,
  platform: 'tiktok' // Solo TikTok para prueba
};

console.log('📤 Enviando request a Vercel...\n');

fetch('https://browserless-test.vercel.app/api/extract', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Respuesta:\n');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data.tiktok) {
      console.log('\n🎉 ¡TikTok extraído correctamente!');
      console.log('Período:', data.data.tiktok.periodo);
      console.log('Métricas:', Object.keys(data.data.tiktok).filter(k => k !== 'periodo'));
    }
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
  });
