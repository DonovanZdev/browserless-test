/**
 * Script para formatear respuesta de extract-all-platforms en n8n
 * Uso: Pega esto en un nodo Code (JavaScript) después del HTTP Request
 * Input: $json (la respuesta del endpoint)
 */

// Manejar si viene como array o como objeto directo
let data;
if (Array.isArray($json)) {
  data = $json[0]?.data; // Si viene en array
} else if ($json.data) {
  data = $json.data; // Si viene como objeto directo
} else {
  data = $json; // Si ya es directamente los datos
}

if (!data) {
  return [{ json: { error: "No se encontraron datos", received: $json } }];
}

const platforms = data.platforms;

// Función para formatear números
const formatNumber = (num) => {
  if (!num) return "0";
  return parseInt(num).toLocaleString('es-MX');
};

// Función para sumar todos los valores históricos
const sumHistoricalData = (historicalData) => {
  if (!historicalData || !Array.isArray(historicalData)) return 0;
  return historicalData.reduce((sum, item) => {
    const val = parseInt(item.valor) || 0;
    return sum + val;
  }, 0);
};

// Resumen presentable
const summary = {
  "Fecha Extracción": new Date(data.timestamp).toLocaleString('es-MX'),
  "Período": data.period,
  
  "FACEBOOK": {},
  "INSTAGRAM": {},
  "TIKTOK": {}
};

// Facebook
if (platforms.facebook && platforms.facebook.metrics) {
  const fbMetrics = platforms.facebook.metrics;
  summary.FACEBOOK = {
    "Visualizaciones": formatNumber(sumHistoricalData(fbMetrics.Visualizaciones?.historicalData)),
    "Espectadores": formatNumber(sumHistoricalData(fbMetrics.Espectadores?.historicalData)),
    "Interacciones": formatNumber(sumHistoricalData(fbMetrics.Interacciones?.historicalData)),
    "Clics": formatNumber(sumHistoricalData(fbMetrics["Clics enlace"]?.historicalData)),
    "Visitas": formatNumber(sumHistoricalData(fbMetrics.Visitas?.historicalData)),
    "Seguidores": formatNumber(fbMetrics.Seguidores?.historicalData?.[fbMetrics.Seguidores.historicalData.length - 1]?.valor || "0"),
    "Total puntos": fbMetrics.Visualizaciones?.totalPoints || 0
  };
}

// Instagram
if (platforms.instagram && platforms.instagram.metrics) {
  const igMetrics = platforms.instagram.metrics;
  summary.INSTAGRAM = {
    "Visualizaciones": formatNumber(sumHistoricalData(igMetrics.Visualizaciones?.historicalData)),
    "Espectadores": formatNumber(sumHistoricalData(igMetrics.Espectadores?.historicalData)),
    "Interacciones": formatNumber(sumHistoricalData(igMetrics.Interacciones?.historicalData)),
    "Clics": formatNumber(sumHistoricalData(igMetrics["Clics enlace"]?.historicalData)),
    "Visitas": formatNumber(sumHistoricalData(igMetrics.Visitas?.historicalData)),
    "Seguidores": formatNumber(igMetrics.Seguidores?.historicalData?.[igMetrics.Seguidores.historicalData.length - 1]?.valor || "0"),
    "Total puntos": igMetrics.Visualizaciones?.totalPoints || 0
  };
}

// TikTok
if (platforms.tiktok) {
  const tk = platforms.tiktok;
  summary.TIKTOK = {
    "Visualizaciones Videos": tk.visualizaciones_videos || "0",
    "Visualizaciones Perfil": tk.visualizaciones_perfil || "0",
    "Me Gusta": tk.me_gusta || "0",
    "Comentarios": tk.comentarios || "0",
    "Veces Compartido": tk.veces_compartido || "0",
    "Recompensas": tk.recompensas_estimadas || "$0",
    "Período": tk.periodo || ""
  };
}

return [{ json: summary }];
