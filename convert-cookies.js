const fs = require('fs');

// Leer el archivo actual
const rawData = JSON.parse(fs.readFileSync('tiktok-cookies.json', 'utf-8'));

// Convertir formato
const cookieArray = [];

if (Array.isArray(rawData) && rawData.length > 0) {
  const cookieObj = rawData[0];
  
  // Convertir cada propiedad en una cookie {name, value}
  Object.entries(cookieObj).forEach(([name, value]) => {
    if (name && value) {
      cookieArray.push({
        name: name,
        value: value,
        domain: '.tiktok.com',
        path: '/',
        secure: true,
        httpOnly: true
      });
    }
  });
}

console.log(`Convertidas ${cookieArray.length} cookies al formato correcto`);

// Guardar el nuevo formato
fs.writeFileSync('tiktok-cookies-converted.json', JSON.stringify(cookieArray, null, 2));
console.log('✅ Guardado como: tiktok-cookies-converted.json');

// Mostrar primeras 3 cookies como ejemplo
console.log('\nPrimeras 3 cookies:');
cookieArray.slice(0, 3).forEach((cookie, i) => {
  console.log(`  ${i + 1}. ${cookie.name}: ${cookie.value.slice(0, 40)}...`);
});
