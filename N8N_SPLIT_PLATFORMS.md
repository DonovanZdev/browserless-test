# Flujo en n8n: Separar TikTok, Facebook e Instagram a Sheets Diferentes

## 📋 Estructura del Flujo

```
HTTP Request
    ↓
Function (Separar datos)
    ↓
Switch (Branching)
    ├─→ Google Sheets (TikTok)
    ├─→ Google Sheets (Facebook)
    └─→ Google Sheets (Instagram)
```

---

## 🔧 Configuración Nodo por Nodo

### NODO 1: HTTP Request

**URL:**
```
https://browserless-test.vercel.app/api/extract-all-platforms
```

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "tiktokCookies": {{ $env.TIKTOK_COOKIES }},
  "facebookCookies": {{ $env.FACEBOOK_COOKIES }},
  "instagramCookies": {{ $env.INSTAGRAM_COOKIES }},
  "period": "LAST_28D"
}
```

---

### NODO 2: Function - Separar Plataformas

**Script:**
```javascript
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
```

---

### NODO 3: Switch - Separar por Plataforma

**Tipo:** Switch

**Condición 1 (TikTok):**
```
Expresión: 1 = 1 (siempre verdadero)
Output: tiktok (conectar a Google Sheets TikTok)
```

**Condición 2 (Facebook):**
```
Expresión: 1 = 1 (siempre verdadero)
Output: facebook (conectar a Google Sheets Facebook)
```

**Condición 3 (Instagram):**
```
Expresión: 1 = 1 (siempre verdadero)
Output: instagram (conectar a Google Sheets Instagram)
```

---

### NODO 4A: Google Sheets - TikTok

**Credentials:** Tu credencial de Google Sheets

**Operation:** Append (o Clear All & Write)

**Spreadsheet ID:** ID de tu Google Sheet

**Sheet Name:** `TikTok`

**Column Names:**
- Fecha
- Fecha ISO
- Visualizaciones Videos
- Visualizaciones Perfil
- Me Gusta
- Comentarios
- Veces Compartido
- Plataforma
- Período
- Fecha Extracción

**Data to Write:**
```
Expression: {{ $json.tiktok.data }}
```

---

### NODO 4B: Google Sheets - Facebook

**Credentials:** Tu credencial de Google Sheets

**Operation:** Append (o Clear All & Write)

**Spreadsheet ID:** ID de tu Google Sheet

**Sheet Name:** `Facebook`

**Column Names:** (Deja que n8n auto-complete o escribe manualmente)
- Fecha
- Fecha ISO
- Visualizaciones
- Espectadores
- Interacciones
- Clics enlace
- Visitas
- Seguidores
- Plataforma
- Período
- Fecha Extracción

**Data to Write:**
```
Expression: {{ $json.facebook.data }}
```

---

### NODO 4C: Google Sheets - Instagram

**Credentials:** Tu credencial de Google Sheets

**Operation:** Append (o Clear All & Write)

**Spreadsheet ID:** ID de tu Google Sheet (mismo o diferente)

**Sheet Name:** `Instagram`

**Column Names:** Igual a Facebook

**Data to Write:**
```
Expression: {{ $json.instagram.data }}
```

---

## 🎯 Pasos en n8n

1. **Crear Workflow** nuevo
2. **Agregar HTTP Request** (obtener datos de todas las plataformas)
3. **Agregar Function** (ejecutar script de separación)
4. **Agregar Switch** (crear tres ramas)
5. **Rama 1: Google Sheets TikTok**
6. **Rama 2: Google Sheets Facebook**
7. **Rama 3: Google Sheets Instagram**
8. **Test** el workflow completo
9. **Activar** para ejecución automática

---

## ✨ Estructura de Google Sheets

**Sheet: TikTok**
```
Fecha | Fecha ISO | Vids Videos | Vids Perfil | Likes | Comentarios | Compartidos
4 dic | 2025-12-04 | 0 | 0 | 0 | 0 | 0
5 dic | 2025-12-05 | 2 | 1 | 0 | 0 | 0
...
```

**Sheet: Facebook**
```
Fecha | Fecha ISO | Visualizaciones | Espectadores | Interacciones | ...
4 dic | 2025-12-04 | 15744869 | 5476376 | 103629 | ...
5 dic | 2025-12-05 | 23050161 | 5045333 | 214272 | ...
...
```

**Sheet: Instagram**
```
Fecha | Fecha ISO | Visualizaciones | Espectadores | Interacciones | ...
4 dic | 2025-12-04 | 5013748 | (vacío) | 131025 | ...
5 dic | 2025-12-05 | 10065839 | (vacío) | 295729 | ...
...
```

---

## 🔄 Cómo Funciona

1. **HTTP Request** obtiene JSON con TikTok + Facebook + Instagram
2. **Function** procesa cada plataforma:
   - TikTok: extrae 5 métricas (videos, perfil, likes, comentarios, compartidos)
   - Facebook: extrae 6 métricas (visualizaciones, espectadores, interacciones, clics, visitas, seguidores)
   - Instagram: extrae 5 métricas (visualizaciones, interacciones, clics, visitas, seguidores)
   - Crea una fila por cada día
   - Retorna tres arrays (uno para cada plataforma)
3. **Switch** distribuye los datos:
   - `tiktok.data` → Google Sheets TikTok
   - `facebook.data` → Google Sheets Facebook
   - `instagram.data` → Google Sheets Instagram

---

## 💡 Tips

- **Mismo Sheet, diferentes tabs:** Usa "TikTok", "Facebook" e "Instagram" como nombres de sheets
- **Sheets separados:** Cambia el Spreadsheet ID en cada nodo de Google Sheets
- **Actualizar datos:** Usa "Clear All & Write" para reemplazar datos existentes cada día
- **Agregar datos:** Usa "Append" para agregar nuevas filas sin borrar las antiguas
- **Horario:** Agrega nodo Schedule para ejecutar automáticamente cada día

---

## 📊 Resultado Final

Tendrás tres sheets automáticamente actualizados:
- ✅ TikTok con todas sus métricas (28 días o el período solicitado)
- ✅ Facebook con todas sus métricas (28 días o el período solicitado)
- ✅ Instagram con todas sus métricas (28 días o el período solicitado)

Listos para hacer gráficos y análisis. 📈
