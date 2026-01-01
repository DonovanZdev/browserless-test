/**
 * Script para n8n - Separar datos de TikTok, Facebook e Instagram
 * 
 * CÓMO USAR EN N8N:
 * 1. Nodo HTTP Request → obtiene JSON de todas las plataformas
 * 2. Nodo Function → usa este código
 * 3. Nodo Switch → separa en tres ramas (TikTok, Facebook e Instagram)
 * 4. Rama TikTok → Google Sheets (sheet "TikTok")
 * 5. Rama Facebook → Google Sheets (sheet "Facebook")
 * 6. Rama Instagram → Google Sheets (sheet "Instagram")
 */

// Obtener datos del request anterior
const requestData = $input.first().json;

if (!requestData.success || !requestData.data?.platforms) {
  throw new Error('Invalid multi-platform response format');
}

const platforms = requestData.data.platforms;
const timestamp = requestData.data.timestamp;
const period = requestData.data.period;

// Función para transformar datos de una plataforma
function transformPlatformData(platformName, platformData) {
  console.log(`📊 Procesando ${platformName}...`);
  
  if (!platformData?.metrics) {
    console.log(`⚠️ Sin datos de métricas para ${platformName}`);
    return [];
  }
  
  const metrics = platformData.metrics;
  const daysMap = new Map();
  
  // Procesar cada métrica
  Object.entries(metrics).forEach(([metricName, metricData]) => {
    if (!metricData.historicalData || metricData.historicalData.length === 0) {
      console.log(`  ⚠️ Sin histórico para ${metricName}`);
      return;
    }
    
    // Procesar cada día
    metricData.historicalData.forEach((dayData) => {
      const dateKey = dayData.date;
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          fecha: dayData.fecha,
          date: dateKey,
          timestamp: dayData.timestamp
        });
      }
      
      // Agregar métrica al día
      daysMap.get(dateKey)[metricName] = dayData.valor;
    });
  });
  
  // Convertir a array de filas ordenadas
  const rows = Array.from(daysMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((day) => ({
      'Fecha': day.fecha,
      'Fecha ISO': day.date,
      'Visualizaciones': parseInt(day.Visualizaciones || 0),
      'Espectadores': parseInt(day.Espectadores || 0),
      'Interacciones': parseInt(day.Interacciones || 0),
      'Clics enlace': parseInt(day['Clics enlace'] || 0),
      'Visitas': parseInt(day.Visitas || 0),
      'Seguidores': parseInt(day.Seguidores || 0),
      'Plataforma': platformName,
      'Período': period,
      'Fecha Extracción': new Date(timestamp).toISOString().split('T')[0]
    }));
  
  console.log(`✅ ${platformName}: ${rows.length} días procesados`);
  return rows;
}

// Procesar Facebook
let facebookRows = [];
if (platforms.facebook) {
  facebookRows = transformPlatformData('Facebook', platforms.facebook);
}

// Procesar Instagram
let instagramRows = [];
if (platforms.instagram) {
  instagramRows = transformPlatformData('Instagram', platforms.instagram);
}

// Función especial para TikTok (estructura diferente)
function transformTikTokData(platformData) {
  console.log('📊 Procesando TikTok...');
  
  if (!platformData?.metrics) {
    console.log('⚠️ Sin datos de métricas para TikTok');
    return [];
  }
  
  const metrics = platformData.metrics;
  const daysMap = new Map();
  
  // Procesar cada métrica de TikTok
  Object.entries(metrics).forEach(([metricName, metricData]) => {
    if (!metricData.historicalData || metricData.historicalData.length === 0) {
      return;
    }
    
    // Procesar cada día
    metricData.historicalData.forEach((dayData) => {
      const dateKey = dayData.date;
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          fecha: dayData.fecha,
          date: dateKey,
          timestamp: dayData.timestamp
        });
      }
      
      // Agregar métrica al día con nombre normalizado
      const normalizedName = metricName
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      daysMap.get(dateKey)[normalizedName] = dayData.valor;
    });
  });
  
  // Convertir a array de filas ordenadas
  const rows = Array.from(daysMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((day) => ({
      'Fecha': day.fecha,
      'Fecha ISO': day.date,
      'Visualizaciones Videos': parseInt(day['Visualizaciones Videos'] || 0),
      'Visualizaciones Perfil': parseInt(day['Visualizaciones Perfil'] || 0),
      'Me Gusta': parseInt(day['Me Gusta'] || 0),
      'Comentarios': parseInt(day['Comentarios'] || 0),
      'Veces Compartido': parseInt(day['Veces Compartido'] || 0),
      'Plataforma': 'TikTok',
      'Período': period,
      'Fecha Extracción': new Date(timestamp).toISOString().split('T')[0]
    }));
  
  console.log(`✅ TikTok: ${rows.length} días procesados`);
  return rows;
}

// Procesar TikTok
let tiktokRows = [];
if (platforms.tiktok) {
  tiktokRows = transformTikTokData(platforms.tiktok);
}

// Retornar las tres plataformas
return {
  tiktok: {
    platform: 'TikTok',
    data: tiktokRows,
    rowCount: tiktokRows.length
  },
  facebook: {
    platform: 'Facebook',
    data: facebookRows,
    rowCount: facebookRows.length
  },
  instagram: {
    platform: 'Instagram',
    data: instagramRows,
    rowCount: instagramRows.length
  }
};
