/**
 * Script para n8n - Transformar JSON de TikTok a Tabla Bonita
 * 
 * USAGE EN N8N:
 * - Conecta HTTP Request (TikTok) → Function (este script) → Google Sheets / Base de datos
 * - Retorna un array de objetos (filas para Google Sheets)
 * 
 * INPUT: Output del API extract-tiktok-historical
 * OUTPUT: Array de objetos formateado para tabla
 */

// Obtener el JSON del input
const input = $input.first().json;

console.log('📊 Iniciando transformación de datos TikTok...');
console.log(`   Período solicitado: ${input.period} días`);
console.log(`   Fecha de query: ${input.query_date}`);

// Validar que el request fue exitoso
if (!input || !input.metrics) {
  console.error('❌ El input no tiene la estructura esperada');
  throw new Error('Invalid TikTok response format');
}

const metrics = input.metrics;
const extractedDate = new Date(input.timestamp);
const queryDate = input.query_date;

// Crear mapa de días para consolidar todas las métricas
const daysMap = new Map();

// Procesar cada métrica
Object.entries(metrics).forEach(([metricName, metricData]) => {
  console.log(`   📈 Procesando métrica: ${metricName} (total: ${metricData.total})`);
  
  // Si no hay datos históricos, saltar
  if (!metricData.history || metricData.history.length === 0) {
    console.log(`      ⚠️  Sin datos históricos`);
    return;
  }
  
  // Procesar cada día del histórico
  metricData.history.forEach((dayData) => {
    const dateKey = dayData.date;
    
    // Crear entrada para este día si no existe
    if (!daysMap.has(dateKey)) {
      const dateObj = new Date(dateKey + 'T00:00:00Z');
      const fechaFormato = dateObj.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      daysMap.set(dateKey, {
        date: dateKey,
        fecha: fechaFormato,
        timestamp: dateObj.getTime(),
        video_views: 0,
        profile_views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        reached_audience: 0,
        followers: 0
      });
    }
    
    // Asignar el valor a la métrica correspondiente
    const dayRecord = daysMap.get(dateKey);
    dayRecord[metricName] = dayData.value;
  });
});

// Convertir Map a Array, ordenar por fecha
const rows = Array.from(daysMap.values())
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((day) => ({
    'Fecha': day.fecha,
    'Fecha ISO': day.date,
    'Visualizaciones de Videos': day.video_views || 0,
    'Visualizaciones de Perfil': day.profile_views || 0,
    'Me Gusta': day.likes || 0,
    'Comentarios': day.comments || 0,
    'Veces Compartido': day.shares || 0,
    'Audiencia Alcanzada': day.reached_audience || 0,
    'Seguidores': day.followers || 0,
    'Período': input.periodRange || `${input.period} días`,
    'Descripción Período': input.periodDescription || '',
    'Fecha Extracción': extractedDate.toISOString().split('T')[0],
    'Hora Extracción': extractedDate.toISOString().split('T')[1].substring(0, 8),
    'Zona Horaria': 'UTC-6 (México)'
  }));

// Resumen en consola
console.log(`✅ Transformación completada: ${rows.length} días procesados`);

if (rows.length > 0) {
  console.log(`   📅 Primer día: ${rows[0]['Fecha']}`);
  console.log(`      - Visualizaciones: ${rows[0]['Visualizaciones de Videos']}`);
  console.log(`   📅 Último día: ${rows[rows.length - 1]['Fecha']}`);
  console.log(`      - Visualizaciones: ${rows[rows.length - 1]['Visualizaciones de Videos']}`);
  
  // Calcular totales
  const totals = {
    video_views: rows.reduce((sum, row) => sum + (row['Visualizaciones de Videos'] || 0), 0),
    profile_views: rows.reduce((sum, row) => sum + (row['Visualizaciones de Perfil'] || 0), 0),
    likes: rows.reduce((sum, row) => sum + (row['Me Gusta'] || 0), 0),
    comments: rows.reduce((sum, row) => sum + (row['Comentarios'] || 0), 0),
    shares: rows.reduce((sum, row) => sum + (row['Veces Compartido'] || 0), 0),
    reached: rows.reduce((sum, row) => sum + (row['Audiencia Alcanzada'] || 0), 0),
    followers: rows.reduce((sum, row) => sum + (row['Seguidores'] || 0), 0)
  };
  
  console.log(`\n📊 TOTALES DEL PERÍODO:`);
  console.log(`   Total Visualizaciones Videos: ${totals.video_views}`);
  console.log(`   Total Visualizaciones Perfil: ${totals.profile_views}`);
  console.log(`   Total Me Gusta: ${totals.likes}`);
  console.log(`   Total Comentarios: ${totals.comments}`);
  console.log(`   Total Compartidos: ${totals.shares}`);
  console.log(`   Total Audiencia Alcanzada: ${totals.reached}`);
  console.log(`   Total Seguidores: ${totals.followers}`);
}

return rows;
