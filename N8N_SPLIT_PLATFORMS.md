# Flujo en n8n: Separar TikTok, Facebook e Instagram a Sheets Diferentes

## 📋 Estructura del Flujo (CON DOS REQUESTS HTTP)

```
HTTP Request 1 (Facebook + Instagram)
    ↓
HTTP Request 2 (TikTok)
    ↓
Merge (Combinar ambos)
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

### NODO 1: HTTP Request - Facebook e Instagram

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
  "facebookCookies": {{ $env.FACEBOOK_COOKIES }},
  "instagramCookies": {{ $env.INSTAGRAM_COOKIES }},
  "period": "LAST_28D"
}
```

---

### NODO 2: HTTP Request - TikTok

**URL:**
```
https://browserless-test.vercel.app/api/extract-tiktok
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
  "period": "LAST_28D"
}
```

---

### NODO 3: Merge - Combinar ambos requests

**Tipo:** Merge

**Combine:** All Input Data

Esto combinará ambos requests en un único array que se pasará al Function

---

### NODO 4: Function - Separar Plataformas

**Script:**
```javascript
// Obtener datos de AMBOS requests (HTTP 1 + HTTP 2 desde el Merge)
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
    // Si es un request de TikTok
    else if (data.data.metrics) {
      platforms.tiktok = data.data;
      timestamp = data.data.timestamp || timestamp;
      period = data.data.period || period;
    }
  }
});

if (Object.keys(platforms).length === 0) {
  throw new Error('No valid platform data received from requests');
}

if (Object.keys(platforms).length === 0) {
  throw new Error('No valid platform data received from requests');
}

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

## 🎯 Pasos Exactos en n8n (COPIA Y PEGA)

### Paso 1: Crear 2 HTTP Requests

**Node 1: "Scraping Facebook e Insta"**
```
Method: POST
URL: https://browserless-test.vercel.app/api/extract-all-platforms
Body (JSON):
{
  "facebookCookies": {{ $env.FACEBOOK_COOKIES }},
  "instagramCookies": {{ $env.INSTAGRAM_COOKIES }},
  "period": "LAST_28D"
}
```

**Node 2: "Scraping TikTok"**
```
Method: POST
URL: https://browserless-test.vercel.app/api/extract-tiktok
Body (JSON):
{
  "tiktokCookies": {{ $env.TIKTOK_COOKIES }},
  "period": "LAST_28D"
}
```

### Paso 2: Agregar Nodo Merge
- **Type:** Merge
- **Combine:** All Input Data
- Conecta: HTTP Node 1 → Merge
- Conecta: HTTP Node 2 → Merge

### Paso 3: Agregar Function Node
Copia TODO el contenido de [n8n-split-platforms.js](n8n-split-platforms.js) (desde línea 15 en adelante) en el Function node.

O cópialo directo desde aquí:
```javascript
let platforms = {};
let timestamp = new Date().toISOString();
let period = 'LAST_28D';

const inputs = $input.all();

inputs.forEach((input) => {
  const data = input.json;
  
  if (data.success && data.data) {
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
    else if (data.data.metrics) {
      platforms.tiktok = data.data;
      timestamp = data.data.timestamp || timestamp;
      period = data.data.period || period;
    }
  }
});

if (Object.keys(platforms).length === 0) {
  throw new Error('No valid platform data received from requests');
}

function transformPlatformData(platformName, platformData) {
  if (!platformData?.metrics) return [];
  
  const metrics = platformData.metrics;
  const daysMap = new Map();
  
  Object.entries(metrics).forEach(([metricName, metricData]) => {
    if (!metricData.historicalData || metricData.historicalData.length === 0) return;
    
    metricData.historicalData.forEach((dayData) => {
      const dateKey = dayData.date;
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          fecha: dayData.fecha,
          date: dateKey,
          timestamp: dayData.timestamp
        });
      }
      
      daysMap.get(dateKey)[metricName] = dayData.valor;
    });
  });
  
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
  
  return rows;
}

function transformTikTokData(platformData) {
  if (!platformData?.metrics) return [];
  
  const metrics = platformData.metrics;
  const daysMap = new Map();
  
  Object.entries(metrics).forEach(([metricName, metricData]) => {
    if (!metricData.historicalData || metricData.historicalData.length === 0) return;
    
    metricData.historicalData.forEach((dayData) => {
      const dateKey = dayData.date;
      
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          fecha: dayData.fecha,
          date: dateKey,
          timestamp: dayData.timestamp
        });
      }
      
      daysMap.get(dateKey)[metricName] = dayData.valor;
    });
  });
  
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
  
  return rows;
}

let facebookRows = [];
if (platforms.facebook) {
  facebookRows = transformPlatformData('Facebook', platforms.facebook);
}

let instagramRows = [];
if (platforms.instagram) {
  instagramRows = transformPlatformData('Instagram', platforms.instagram);
}

let tiktokRows = [];
if (platforms.tiktok) {
  tiktokRows = transformTikTokData(platforms.tiktok);
}

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

### Paso 4: Agregar 3 Google Sheets Nodes

**Node 4A: Google Sheets - TikTok**
```
Operation: Append (or Clear All & Write)
Spreadsheet: Tu Google Sheet
Sheet Name: TikTok
Data to Write: {{ $json.tiktok.data }}
```

**Node 4B: Google Sheets - Facebook**
```
Operation: Append (or Clear All & Write)
Spreadsheet: Tu Google Sheet
Sheet Name: Facebook
Data to Write: {{ $json.facebook.data }}
```

**Node 4C: Google Sheets - Instagram**
```
Operation: Append (or Clear All & Write)
Spreadsheet: Tu Google Sheet
Sheet Name: Instagram
Data to Write: {{ $json.instagram.data }}
```

Conecta Function Node → Google Sheets (1) → (2) → (3)

## 🎯 Pasos en n8n (OLD - Guardado como referencia)



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
