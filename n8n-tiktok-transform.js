// N8N JavaScript Node para transformar raw metrics de TikTok a histórico con fechas correctas
// Input: $json con raw_metrics del API de extract-tiktok-historical
// Output: Métricas transformadas con fechas en formato YYYY-MM-DD

// Intentar obtener los datos de diferentes formas (compatibilidad con diferentes versiones de n8n)
let input;
if ($json && $json.raw_metrics) {
  input = $json;
} else if ($json && Array.isArray($json) && $json[0] && $json[0].raw_metrics) {
  input = $json[0];
} else if (typeof data !== 'undefined' && data && data.body) {
  input = Array.isArray(data.body) ? data.body[0] : data.body;
} else if (typeof data !== 'undefined' && data && data.raw_metrics) {
  input = data;
} else {
  throw new Error('Invalid input: cannot find raw_metrics in $json or data');
}

if (!input || !input.raw_metrics) {
  throw new Error('Invalid input: missing raw_metrics');
}

const { timestamp, period, raw_metrics } = input;

// 1. Convertir timestamp UTC a hora de México (UTC-6)
const apiTime = new Date(timestamp);
const mexicoTime = new Date(apiTime.getTime() - (6 * 60 * 60 * 1000));

// 2. Calcular ayer en zona horaria de México
const yesterdayMexico = new Date(mexicoTime);
yesterdayMexico.setHours(0, 0, 0, 0);
yesterdayMexico.setDate(yesterdayMexico.getDate() - 1);

// 3. Función para filtrar y procesar métrica
function processMetric(rawArray, metricName) {
  if (!rawArray) return null;
  
  // Filtrar solo elementos completados (status === 0)
  let completedValues = rawArray.filter(item => item && item.status === 0).map(item => item.value);
  
  // Invertir para obtener orden correcto (TikTok retorna del más reciente al más antiguo)
  completedValues = completedValues.reverse();
  
  // Función para generar array de fechas
  function generateHistoryWithDates(values) {
    const result = [];
    
    // Siempre usar exactamente 'period' elementos para el rango de fechas
    const targetLength = period;
    
    // Calcular la fecha de inicio basada en 'period'
    const firstDate = new Date(yesterdayMexico);
    firstDate.setDate(firstDate.getDate() - (period - 1));
    
    // Generar array de fechas
    for (let i = 0; i < targetLength; i++) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      // Si no hay valor para este índice, usar 0
      const value = values[i] !== undefined ? values[i] : 0;
      
      result.push({
        date: dateStr,
        value: value || 0
      });
    }
    
    return result;
  }
  
  return {
    total: completedValues.reduce((a, b) => a + (b || 0), 0),
    history: generateHistoryWithDates(completedValues)
  };
}

// 4. Procesar todas las métricas
const output = {
  timestamp: timestamp,
  period: period,
  query_date: mexicoTime.toISOString().split('T')[0],
  metrics: {
    video_views: processMetric(raw_metrics.video_views, 'video_views'),
    profile_views: processMetric(raw_metrics.profile_views, 'profile_views'),
    likes: processMetric(raw_metrics.likes, 'likes'),
    comments: processMetric(raw_metrics.comments, 'comments'),
    shares: processMetric(raw_metrics.shares, 'shares'),
    reached_audience: processMetric(raw_metrics.reached_audience, 'reached_audience'),
    followers: processMetric(raw_metrics.followers, 'followers')
  }
};

return output;
