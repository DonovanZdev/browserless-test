const puppeteer = require("puppeteer-core");
const fs = require('fs');

const TOKEN = process.env.BROWSERLESS_TOKEN || "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function debugTikTokAPI() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const cookies = JSON.parse(fs.readFileSync('./tiktok-cookies.json', 'utf-8'));
    
    // Parsear cookies
    const cookieArray = cookies
      .filter(cookie => cookie && cookie.name && cookie.value)
      .map(cookie => ({
        name: String(cookie.name),
        value: String(cookie.value),
        domain: cookie.domain || '.tiktok.com',
        path: cookie.path || '/',
        secure: Boolean(cookie.secure !== false),
        httpOnly: Boolean(cookie.httpOnly !== false)
      }));

    await page.setCookie(...cookieArray);
    console.log('✅ Cookies configuradas\n');

    // IMPORTANTE: Cambiar el end_days para probar diferentes rangos
    const testCases = [
      { days: 32, end_days: 1, desc: "últimos 32 días (standard)" },
      { days: 31, end_days: 1, desc: "últimos 31 días" },
      { days: 31, end_days: 0, desc: "últimos 31 días (end_days=0)" }
    ];

    for (const testCase of testCases) {
      console.log(`\n${"=".repeat(70)}`);
      console.log(`📊 TEST: ${testCase.desc}`);
      console.log(`   Parameters: days=${testCase.days}, end_days=${testCase.end_days}`);
      console.log(`${"=".repeat(70)}`);

      const typeRequests = [
        { "insigh_type": "vv_history", "days": testCase.days, "end_days": testCase.end_days },
        { "insigh_type": "pv_history", "days": testCase.days, "end_days": testCase.end_days },
        { "insigh_type": "like_history", "days": testCase.days, "end_days": testCase.end_days },
        { "insigh_type": "comment_history", "days": testCase.days, "end_days": testCase.end_days },
        { "insigh_type": "share_history", "days": testCase.days, "end_days": testCase.end_days }
      ];

      const baseUrl = "https://www.tiktok.com/aweme/v2/data/insight/";
      const params = new URLSearchParams({
        locale: "en",
        aid: "1988",
        priority_region: "MX",
        tz_name: "America/Mexico_City",
        app_name: "tiktok_creator_center",
        app_language: "en",
        device_platform: "web_pc",
        channel: "tiktok_web",
        device_id: "7586552972738463288",
        os: "win",
        tz_offset: "-6",
        type_requests: JSON.stringify(typeRequests)
      });

      const url = `${baseUrl}?${params.toString()}`;

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        const metricsData = await page.evaluate(() => {
          try {
            return JSON.parse(document.body.innerText);
          } catch (e) {
            return null;
          }
        });

        if (!metricsData || metricsData.status_code !== 0) {
          console.log(`❌ API Error: ${metricsData?.status_msg || 'Unknown error'}\n`);
          continue;
        }

        // Analizar vv_history (video views) en detalle
        const vvRaw = metricsData.vv_history || [];
        
        console.log(`\n📈 VIDEO_VIEWS (vv_history) - ANÁLISIS DETALLADO:`);
        console.log(`   Total elementos crudos: ${vvRaw.length}`);
        
        // Mostrar TODOS los elementos sin filtrar
        console.log(`\n   🔍 Array RAW COMPLETO (sin filtrar):`);
        for (let i = 0; i < vvRaw.length; i++) {
          const item = vvRaw[i];
          const status = item?.status || '?';
          const value = item?.value || 0;
          console.log(`      [${String(i).padStart(2, '0')}] status=${status}, value=${value}`);
        }
        
        // Ahora filtrar
        const vvFiltered = vvRaw
          .filter(item => item && item.status === 0)
          .map(item => item.value || 0);

        console.log(`\n   Elementos con status=0: ${vvFiltered.length}`);
        console.log(`   Valores después de filtrar: [${vvFiltered.join(', ')}]`);

        // Comparar con datos esperados del CSV
        const expectedCSV = [1, 0, 1, 1, 0, 0, 1, 0, 0, 14, 0, 0, 0, 14, 2, 1, 0, 0, 0, 2, 0, 0, 0, 0, 2, 1, 0, 0, 0, 1, 0]; // 31 días
        
        console.log(`\n   📊 COMPARACIÓN CON CSV REAL:`);
        console.log(`      CSV esperado (31 días): [${expectedCSV.join(', ')}]`);
        console.log(`      API retorna actual:     [${vvFiltered.join(', ')}]`);
        
        // Buscar dónde comienza el patrón del API en una versión rotada del esperado
        let foundOffset = -1;
        for (let offset = 0; offset < expectedCSV.length; offset++) {
          const rotated = [...expectedCSV.slice(offset), ...expectedCSV.slice(0, offset)];
          if (rotated.slice(0, vvFiltered.length).every((v, i) => v === vvFiltered[i])) {
            foundOffset = offset;
            break;
          }
        }
        
        if (foundOffset >= 0) {
          console.log(`   ✅ ENCONTRADO: API está desplazado ${foundOffset} posiciones`);
        } else {
          console.log(`   ❌ NO COINCIDE con ningún desplazamiento circular`);
        }

      } catch (error) {
        console.log(`❌ Error en request: ${error.message}\n`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // esperar entre requests
    }

    await page.close();

  } finally {
    await browser.disconnect();
  }
}

debugTikTokAPI()
  .then(() => {
    console.log('\n✅ Debug completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
