/**
 * Script para n8n - Transformar JSON de Instagram a Google Sheets
 * 
 * USAGE EN N8N:
 * - Conecta HTTP Request (Facebook/Instagram) → Function (este script) → Google Sheets
 * - Retorna un array de objetos (filas para Google Sheets)
 * - Extrae SOLO Instagram del response
 */

// Obtener el JSON del request
const requestData = $input.first().json;

console.log('📊 Iniciando transformación de datos Instagram...');
console.log(`   Período: ${requestData.data?.period}`);

// Validar que el request fue exitoso y tiene Instagram
if (!requestData.success || !requestData.data?.platforms?.instagram) {
  console.error('❌ El request de Instagram no fue exitoso o no contiene datos');
  throw new Error('Invalid Instagram response format');
}

const instagramData = requestData.data.platforms.instagram;
const metrics = instagramData.metrics;
const extractedDate = new Date(requestData.data.timestamp);

console.log(`   Plataforma: Instagram`);
console.log(`   Período: ${instagramData.period}`);

// Crear mapa de días para consolidar datos
const daysMap = new Map();

// Procesar cada métrica
Object.entries(metrics).forEach(([metricName, metricData]) => {
  console.log(`   📈 Procesando métrica: ${metricName} (total: ${metricData.totalValue})`);
  
  // Si no hay datos históricos, saltar
  if (!metricData.historicalData || metricData.historicalData.length === 0) {
    console.log(`      ⚠️  Sin datos históricos`);
    return;
  }
  
  // Procesar cada día del histórico
  metricData.historicalData.forEach((dayData) => {
    const dateKey = dayData.date;
    
    // Crear entrada para este día si no existe
    if (!daysMap.has(dateKey)) {
      daysMap.set(dateKey, {
        fecha: dayData.fecha,
        date: dateKey,
        timestamp: dayData.timestamp
      });
    }
    
    // Asignar el valor a la métrica correspondiente
    daysMap.get(dateKey)[metricName] = dayData.valor;
  });
});

// Convertir Map a Array, ordenar y formatear
const rows = Array.from(daysMap.values())
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((day) => ({
    'Fecha': day.fecha,
    'Fecha ISO': day.date,
    'Visualizaciones': parseInt(day.Visualizaciones || '0'),
    'Espectadores': parseInt(day.Espectadores || '0'),
    'Interacciones': parseInt(day.Interacciones || '0'),
    'Clics enlace': parseInt(day['Clics enlace'] || '0'),
    'Visitas': parseInt(day.Visitas || '0'),
    'Seguidores': parseInt(day.Seguidores || '0'),
    'Período': instagramData.period,
    'Fecha Extracción': extractedDate.toISOString().split('T')[0],
    'Hora Extracción': extractedDate.toISOString().split('T')[1].substring(0, 8)
  }));

console.log(`✅ Transformación completada: ${rows.length} días procesados`);

if (rows.length > 0) {
  console.log(`   Primer día: ${rows[0]['Fecha']} (${rows[0]['Visualizaciones']} views)`);
  console.log(`   Último día: ${rows[rows.length - 1]['Fecha']} (${rows[rows.length - 1]['Visualizaciones']} views)`);
}

return rows;
