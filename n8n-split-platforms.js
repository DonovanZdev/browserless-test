/**
 * Script para n8n - Separar datos de TikTok, Facebook e Instagram
 * 
 * CÓMO USAR EN N8N (CON DOS REQUESTS HTTP SEPARADOS):
 * 1. Nodo HTTP Request 1 → obtiene JSON de Facebook e Instagram
 * 2. Nodo HTTP Request 2 → obtiene JSON de TikTok
 * 3. Nodo Merge → combina ambos requests en un único JSON
 * 4. Nodo Function → usa este código
 * 5. Nodo Switch → separa en tres ramas (TikTok, Facebook e Instagram)
 * 6. Rama TikTok → Google Sheets (sheet "TikTok")
 * 7. Rama Facebook → Google Sheets (sheet "Facebook")
 * 8. Rama Instagram → Google Sheets (sheet "Instagram")
 */

// Obtener datos de ambos requests
let platforms = {};
let timestamp = new Date().toISOString();
let period = 'LAST_28D';

// Procesar ambos inputs del Merge
const inputs = $input.all();

inputs.forEach((input) => {
  const data = input.json;
  
  if (data.success && data.data) {
    // Si es un request de Facebook e Instagram
    if (data.data.platforms?.facebook || data.data.platforms?.instagram) {
      if (data.data.platforms.facebook) {
        platforms.facebook = data.data.platforms.facebook;
      }
      if (data.data.platforms.instagram) {
        platforms.instagram = data.data.platforms.instagram;
      }
      timestamp = data.data.timestamp || timestamp;
      period = data.data.period || period;
    }
    // Si es un request de TikTok (metrics en data.data)
    else if (data.data.metrics) {
      platforms.tiktok = data.data;
      timestamp = data.data.timestamp || timestamp;
      period = data.data.period || period;
    }
  }
});

// Si no encontró nada, intenta con estructura alternativa (sin data anidado)
if (Object.keys(platforms).length === 0) {
  inputs.forEach((input) => {
    const rawData = input.json;
    
    if (rawData.success) {
      // Intenta acceder directamente a platforms
      if (rawData.data?.platforms?.facebook || rawData.data?.platforms?.instagram) {
        if (rawData.data.platforms.facebook) platforms.facebook = rawData.data.platforms.facebook;
        if (rawData.data.platforms.instagram) platforms.instagram = rawData.data.platforms.instagram;
        timestamp = rawData.data.timestamp || timestamp;
        period = rawData.data.period || period;
      }
      // Intenta acceder directamente a metrics para TikTok
      else if (rawData.data?.metrics) {
        platforms.tiktok = rawData.data;
        timestamp = rawData.data.timestamp || timestamp;
        period = rawData.data.period || period;
      }
    }
  });
}

if (Object.keys(platforms).length === 0) {
  throw new Error('No valid platform data received from requests');
}

// Función para transformar datos de Facebook e Instagram
function transformPlatformData(platformName, platformData) {
  console.log(`📊 Procesando ${platformName}...`);
  
  if (!platformData?.metrics) {
    console.log(`⚠️ Sin datos de métricas para ${platformName}`);
    return [];
  }
  
  const metrics = platformData.metrics;
  const daysMap = new Map();
  const extractedDate = new Date(timestamp);
  
  // Procesar cada métrica
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
      'Período': period,
      'Fecha Extracción': extractedDate.toISOString().split('T')[0],
      'Hora Extracción': extractedDate.toISOString().split('T')[1].substring(0, 8)
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
  const extractedDate = new Date(timestamp);
  
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
      'Visualizaciones Videos': parseInt(day.visualizaciones_videos || 0),
      'Visualizaciones Perfil': parseInt(day.visualizaciones_perfil || 0),
      'Me Gusta': parseInt(day.me_gusta || 0),
      'Comentarios': parseInt(day.comentarios || 0),
      'Veces Compartido': parseInt(day.veces_compartido || 0),
      'Período': period,
      'Fecha Extracción': extractedDate.toISOString().split('T')[0],
      'Hora Extracción': extractedDate.toISOString().split('T')[1].substring(0, 8)
    }));
  
  console.log(`✅ TikTok: ${rows.length} días procesados`);
  return rows;
}

// Procesar TikTok
let tiktokRows = [];
if (platforms.tiktok) {
  tiktokRows = transformTikTokData(platforms.tiktok);
}

// Retornar 3 arrays separados - uno por cada plataforma
// n8n crea 3 items (uno por array) y cada uno se muestra como tabla bonita
return [tiktokRows, facebookRows, instagramRows];
