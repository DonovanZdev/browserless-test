const formatNumber = (num) => {
  const parsed = parseInt(num) || 0;
  return parsed.toLocaleString('es-MX');
};

const formatPlatformData = (platform) => {
  if (!platform || !platform.metrics) return null;
  
  const formatted = {};
  
  Object.entries(platform.metrics).forEach(([key, metric]) => {
    formatted[key] = formatNumber(metric.totalValue);
  });
  
  return formatted;
};

// Detectar formato de entrada
let data = inputs.data;

if (!data && inputs[0] && inputs[0].data) {
  data = inputs[0].data;
}

if (typeof data === 'string') {
  data = JSON.parse(data);
}

if (!data || !data.platforms) {
  return { error: 'No valid data received' };
}

// Formatear cada plataforma
const result = {
  timestamp: data.timestamp,
  period: data.period,
  summary: {}
};

if (data.platforms.facebook) {
  result.summary.Facebook = formatPlatformData(data.platforms.facebook);
}

if (data.platforms.instagram) {
  result.summary.Instagram = formatPlatformData(data.platforms.instagram);
}

if (data.platforms.tiktok) {
  result.summary.TikTok = formatPlatformData(data.platforms.tiktok);
}

return result;
