const fs = require('fs');
const puppeteer = require('puppeteer');

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";
const COOKIES_FILE = './tiktok-cookies-converted.json';

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testVideoViewsExtraction() {
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCookie(...cookies);
  
  const period = 28;
  const analyticsUrl = `https://www.tiktok.com/tiktokstudio/analytics?activeAnalyticsMetric=video_views&dateRange=%7B%22type%22%3A%22fixed%22%2C%22pastDay%22%3A${period}%7D`;
  
  console.log('📍 Navigating to video_views analytics...');
  await page.goto(analyticsUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await sleep(2500);

  console.log('📸 Capturing screenshot...');
  const screenshot = await page.screenshot({ encoding: 'base64' });
  
  const totalValue = 39;
  const prompt = `TAREA CRÍTICA: Extrae los valores EXACTOS de cada punto en el gráfico de TikTok Analytics.

INFORMACIÓN IMPORTANTE:
- Total mostrado: ${totalValue}
- Período: ${period} días
- Gráfico: Línea azul con puntos de datos

INSTRUCCIONES:
1. Identifica TODOS los puntos azules (círculos) en el gráfico
2. Lee DE IZQUIERDA A DERECHA (día 1 → día ${period})
3. CADA punto = 1 día del período
4. Para CADA punto, extrae su valor (mira la altura en el eje Y o el número en el punto)
5. Los valores deben SUMAR exactamente ${totalValue}
6. Si un punto está en 0, escribe 0
7. IMPORTANTE: Devuelve EXACTAMENTE ${period} números

RESPONDE SOLO CON ARRAY JSON DE ${period} NÚMEROS:
[valor_día1, valor_día2, valor_día3, ..., valor_día${period}]

Ejemplo: [0, 0, 5, 0, 3, 0, 0, 2, 0, ...]`;

  console.log('🤖 Calling Vision API...');
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${screenshot}` },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0].message.content.trim();
  console.log('\n📝 Vision response:');
  console.log(content.substring(0, 200));
  
  const arrayMatch = content.match(/\[\s*[\d\s,]*\]/);
  if (arrayMatch) {
    const extractedArray = JSON.parse(arrayMatch[0]);
    const sum = extractedArray.reduce((a, b) => a + b, 0);
    console.log(`\n✅ Extracted ${extractedArray.length} points, sum: ${sum}`);
    console.log(`Array: ${JSON.stringify(extractedArray)}`);
  } else {
    console.log('\n❌ Could not extract array from Vision response');
  }

  await browser.close();
}

testVideoViewsExtraction().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
