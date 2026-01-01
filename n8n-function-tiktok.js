/**
 * Script para n8n - Transformar JSON de TikTok a Google Sheets
 * 
 * USAGE EN N8N:
 * - Conecta HTTP Request (TikTok) → Function (este script) → Google Sheets
 * - Retorna un array de objetos (filas para Google Sheets)
 */

// Obtener el JSON del request
const requestData = $input.first().json;

console.log('📊 Iniciando transformación de datos TikTok...');
console.log(`   Período: ${requestData.data?.period}`);
console.log(`   Días solicitados: ${requestData.data?.daysRequested}`);

// Validar que el request fue exitoso
if (!requestData.success || !requestData.data || !requestData.data.metrics) {
  console.error('❌ El request de TikTok no fue exitoso');
  throw new Error('Invalid TikTok response format');
}

const metrics = requestData.data.metrics;
const extractedDate = new Date(requestData.data.timestamp);

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
    'Visualizaciones Videos': parseInt(day.visualizaciones_videos || '0'),
    'Visualizaciones Perfil': parseInt(day.visualizaciones_perfil || '0'),
    'Me Gusta': parseInt(day.me_gusta || '0'),
    'Comentarios': parseInt(day.comentarios || '0'),
    'Veces Compartido': parseInt(day.veces_compartido || '0'),
    'Período': requestData.data.period,
    'Fecha Extracción': extractedDate.toISOString().split('T')[0],
    'Hora Extracción': extractedDate.toISOString().split('T')[1].substring(0, 8)
  }));

console.log(`✅ Transformación completada: ${rows.length} días procesados`);

if (rows.length > 0) {
  console.log(`   Primer día: ${rows[0]['Fecha']} (${rows[0]['Visualizaciones Videos']} views)`);
  console.log(`   Último día: ${rows[rows.length - 1]['Fecha']} (${rows[rows.length - 1]['Visualizaciones Videos']} views)`);
}

return rows;
