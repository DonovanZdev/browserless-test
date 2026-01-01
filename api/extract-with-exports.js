const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const TOKEN = "2ThMQelUWHfBWdM8f1e02d135a315e02e44d27e13e5020198";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extrae métricas e historial de datos de Facebook
 * Soporta múltiples períodos: LAST_7D, LAST_28D, LAST_90D, THIS_MONTH, etc.
 */
async function extractFacebookMetricsWithHistory(cookies, period = 'LAST_28D', businessId = '176166689688823', assetId = '8555156748') {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${TOKEN}`,
  });

  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  let cookieArray = cookies;
  if (typeof cookies === 'object' && !Array.isArray(cookies)) {
    cookieArray = Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: '.facebook.com'
    }));
  }
  
  await page.setCookie(...cookieArray);

  const timeRange = `%2522${period}%2522`;
  const url = `https://business.facebook.com/latest/insights/results?business_id=${businessId}&asset_id=${assetId}&time_range=${timeRange}&platform=Facebook&audience_tab=demographics`;

  console.log(`\n📊 Extrayendo datos de Facebook (Período: ${period})...`);

  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  await sleep(2000);
  
  await page.keyboard.press('Escape');
  await sleep(800);
  await page.keyboard.press('Escape');
  await sleep(1500);
  
  await page.waitForFunction(() => {
    return document.readyState === 'complete';
  }, { timeout: 10000 });

  await sleep(2000);
  
  const metricsData = {};
  
  const metrics = [
    { name: 'Visualizaciones', keyword: 'Visualizaciones', exclude: 'Espectadores' },
    { name: 'Espectadores', keyword: 'Espectadores', exclude: null },
    { name: 'Interacciones', keyword: 'Interacciones con el contenido', exclude: null },
    { name: 'Clics enlace', keyword: 'Clics en el enlace', exclude: null },
    { name: 'Visitas', keyword: 'Visitas', exclude: 'Clics' },
    { name: 'Seguidores', keyword: 'Seguidores', exclude: null }
  ];
  
  console.log('📈 Extrayendo valores de cada métrica...\n');
  
  for (const metricConfig of metrics) {
    const metricValues = await page.evaluate((config) => {
      const result = {
        metricName: config.name,
        containerText: '',
        timestamps: [],
        dailyValues: [],
        dates: [],
        totalValue: ''
      };
      
      let targetContainer = null;
      const allDivs = Array.from(document.querySelectorAll('[role="region"], section, article, div'));
      
      for (const div of allDivs) {
        const text = div.textContent || '';
        
        if (!text.includes(config.keyword)) continue;
        if (config.exclude && text.includes(config.exclude) && text.indexOf(config.exclude) < text.indexOf(config.keyword)) continue;
        if (text.length > 5000) continue;
        if (!div.querySelector('svg')) continue;
        
        if (targetContainer === null || text.length < targetContainer.textContent.length) {
          targetContainer = div;
        }
      }
      
      if (!targetContainer) {
        return result;
      }
      
      result.containerText = targetContainer.innerText;
      
      // Extraer valor total
      const containerText = targetContainer.innerText;
      const lines = containerText.split('\n');
      
      let foundMetricName = false;
      for (const line of lines) {
        if (line.includes(config.keyword)) {
          foundMetricName = true;
        }
        if (foundMetricName && line.match(/\d+[.,]?\d*\s*(mill|mil|k)?/)) {
          result.totalValue = line.trim();
          break;
        }
      }
      
      // Extraer timestamps y valores
      const timestampMatches = containerText.match(/(\d{10})/g) || [];
      const timestamps = [...new Set(timestampMatches)].map(t => parseInt(t)).sort((a, b) => a - b);
      
      // Buscar valores
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Primary') || (line.match(/\d/g) || []).length > 20) {
          const numbers = line.split('\t').filter(x => x.trim()).map(x => parseInt(x.trim())).filter(n => !isNaN(n) && n < 100000000 && n > 0);
          if (numbers.length > 10) {
            result.dailyValues = numbers.slice(0, Math.min(timestamps.length, 100));
            break;
          }
        }
      }
      
      // Extraer fechas
      const dateMatches = containerText.match(/(\d+)\s+de\s+(\w+)/g) || [];
      result.dates = [...new Set(dateMatches)];
      
      result.timestamps = timestamps.slice(0, result.dailyValues.length);
      
      return result;
    }, metricConfig);
    
    // Procesar timestamps a fechas
    const historicalData = [];
    
    for (let i = 0; i < metricValues.timestamps.length && i < metricValues.dailyValues.length; i++) {
      const date = new Date(metricValues.timestamps[i] * 1000);
      const dayNum = date.getDate();
      const monthNum = date.getMonth();
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const fechaStr = `${dayNum} de ${months[monthNum]}`;
      
      historicalData.push({
        fecha: fechaStr,
        valor: metricValues.dailyValues[i].toString(),
        timestamp: metricValues.timestamps[i],
        date: date.toISOString().split('T')[0]
      });
    }
    
    metricsData[metricConfig.name] = {
      totalValue: metricValues.totalValue,
      historicalData: historicalData,
      totalPoints: historicalData.length
    };
    
    console.log(`  ✅ ${metricConfig.name}: ${historicalData.length} puntos`);
  }

  await browser.close();

  return {
    period: period,
    extractedAt: new Date().toISOString(),
    metrics: metricsData
  };
}

// Vercel API Handler
module.exports = async (req, res) => {
  try {
    const { cookies, period = 'LAST_28D', businessId = '176166689688823', assetId = '8555156748' } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: 'Se requieren cookies válidas como array' });
    }
    
    const data = await extractFacebookMetricsWithHistory(cookies, period, businessId, assetId);
    
    // Crear CSV
    let csvContent = 'Fecha,Visualizaciones,Espectadores,Interacciones,Clics enlace,Visitas,Seguidores\n';
    
    const allDates = new Set();
    Object.values(data.metrics).forEach(metric => {
      metric.historicalData.forEach(item => {
        allDates.add(item.date);
      });
    });
    
    const sortedDates = Array.from(allDates).sort();
    
    sortedDates.forEach(date => {
      let row = '';
      let fechaStr = date;
      
      ['Visualizaciones', 'Espectadores', 'Interacciones', 'Clics enlace', 'Visitas', 'Seguidores'].forEach((metricName, idx) => {
        const item = data.metrics[metricName]?.historicalData?.find(d => d.date === date);
        if (idx === 0) {
          fechaStr = item ? item.fecha : date;
          row = fechaStr;
        }
        row += `,${item ? item.valor : ''}`;
      });
      
      csvContent += row + '\n';
    });
    
    // Respuesta
    res.json({
      success: true,
      period: period,
      metrics: data.metrics,
      csv: csvContent,
      csvLines: csvContent.split('\n').length - 2,
      extractedAt: data.extractedAt
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
