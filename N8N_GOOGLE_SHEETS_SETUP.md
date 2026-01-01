# Integración TikTok Analytics → Google Sheets en n8n

## Estructura del JSON que viene del endpoint

```json
{
  "success": true,
  "data": {
    "timestamp": "2026-01-01T20:03:43.996Z",
    "period": "LAST_60D",
    "daysRequested": 60,
    "platform": "TikTok",
    "metrics": {
      "visualizaciones_videos": {
        "totalValue": "55",
        "historicalData": [
          {"fecha": "2 de nov", "valor": "0", "timestamp": 1704806400, "date": "2025-11-02"},
          {"fecha": "3 de nov", "valor": "2", "timestamp": 1704892800, "date": "2025-11-03"}
        ]
      },
      "visualizaciones_perfil": { ... },
      "me_gusta": { ... },
      "comentarios": { ... },
      "veces_compartido": { ... }
    }
  }
}
```

## Flujo en n8n

### 1️⃣ Nodo: HTTP Request (GET)
```
URL: https://browserless-test.vercel.app/api/extract-tiktok
Method: POST
Headers:
  Content-Type: application/json

Body (JSON):
{
  "tiktokCookies": {{ $('variable_con_cookies').item.json.tiktok_cookies }},
  "period": "LAST_60D"
}
```

### 2️⃣ Nodo: Function (Transformar datos)
```javascript
// Este script transforma el JSON en un array de filas para Google Sheets

const data = $input.first().json;

if (!data.success || !data.data.metrics) {
  return [];
}

const metrics = data.data.metrics;
const timestamp = data.data.timestamp;
const period = data.data.period;

// Recopilar todos los días únicos y sus datos
const daysMap = {};

// Procesar cada métrica
Object.entries(metrics).forEach(([metricName, metricData]) => {
  if (metricData.historicalData && Array.isArray(metricData.historicalData)) {
    metricData.historicalData.forEach((dayData) => {
      const date = dayData.date; // "2025-11-02"
      
      if (!daysMap[date]) {
        daysMap[date] = {
          fecha: dayData.fecha,
          date: date,
          timestamp: dayData.timestamp
        };
      }
      
      // Mapear nombre corto para la métrica
      const metricKey = metricName.replace(/_/g, ' ');
      daysMap[date][metricName] = dayData.valor;
    });
  }
});

// Convertir a array y ordenar por fecha
const rows = Object.values(daysMap)
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((day) => ({
    "Fecha": day.fecha,
    "ISO Date": day.date,
    "Visualizaciones Videos": day.visualizaciones_videos || "0",
    "Visualizaciones Perfil": day.visualizaciones_perfil || "0",
    "Me Gusta": day.me_gusta || "0",
    "Comentarios": day.comentarios || "0",
    "Veces Compartido": day.veces_compartido || "0"
  }));

return rows;
```

### 3️⃣ Nodo: Google Sheets (Append/Write)

**Configuración:**

| Campo | Valor |
|-------|-------|
| **Operation** | Append |
| **Spreadsheet ID** | (Tu ID de sheet) |
| **Sheet Name** | `TikTok` |
| **Column Names** | `Fecha, ISO Date, Visualizaciones Videos, Visualizaciones Perfil, Me Gusta, Comentarios, Veces Compartido` |
| **Data to Write** | (Output del nodo Function) |

**En la sección "Values":**
```
Fecha: {{ $json.Fecha }}
ISO Date: {{ $json['ISO Date'] }}
Visualizaciones Videos: {{ $json['Visualizaciones Videos'] }}
Visualizaciones Perfil: {{ $json['Visualizaciones Perfil'] }}
Me Gusta: {{ $json['Me Gusta'] }}
Comentarios: {{ $json['Comentarios'] }}
Veces Compartido: {{ $json['Veces Compartido'] }}
```

## Opciones de Google Sheets

### Opción A: Crear nueva hoja cada vez
- Google Sheets → Modo: "Append"
- Crea una fila nueva por cada día

### Opción B: Reemplazar datos completos
- Google Sheets → Modo: "Clear All & Write"
- Borra todo y escribe desde cero (ideal para actualizaciones diarias)

### Opción C: Usar Schedule
- Agregar un nodo de Schedule para ejecutar automáticamente cada día
- Ejemplo: Cada día a las 8 AM

## Estructura de la tabla en Google Sheets

| Fecha | ISO Date | Visualizaciones Videos | Visualizaciones Perfil | Me Gusta | Comentarios | Veces Compartido |
|-------|----------|------------------------|------------------------|----------|-------------|------------------|
| 2 de nov | 2025-11-02 | 0 | 0 | 0 | 0 | 0 |
| 3 de nov | 2025-11-03 | 2 | 1 | 0 | 0 | 0 |
| 4 de nov | 2025-11-04 | 5 | 0 | 1 | 0 | 0 |
| ... | ... | ... | ... | ... | ... | ... |

## Pasos en n8n

1. **Crear workflow** con nodo HTTP Request
2. **Conectar** con nodo Function (usar script de transformación)
3. **Agregar** nodo Google Sheets con credenciales
4. **Mapear** columnas en el nodo de Sheets
5. **Test** con un período (LAST_28D primero)
6. **Activar** el workflow

## Variables de Entorno (si necesitas)

Si quieres hacer esto dinámico, usa variables de n8n:
```
{{ $env.TIKTOK_API_URL }}
{{ $env.TIKTOK_COOKIES }}
{{ $env.GOOGLE_SHEET_ID }}
```

## Tips

- **Evitar duplicados**: Usar "Clear All & Write" en lugar de "Append" para actualizaciones diarias
- **Horario**: Schedule para ejecutar después de que las analytics se actualicen en TikTok (típicamente 00:00 UTC)
- **Errores**: Agregar nodo de error handling para notificaciones si falla
- **Validación**: Verificar que Google Sheets tenga las credenciales correctas autorizadas

## Credenciales Google

Ya que dices que tienes credenciales, solo necesitas:
1. En n8n → Credentials → Google Sheets
2. Usar las credenciales existentes
3. Seleccionar el Spreadsheet ID de tu sheet

---

¿Quieres que cree un ejemplo de workflow completo o necesitas ayuda con la configuración de credenciales?
