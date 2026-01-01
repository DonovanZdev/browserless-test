# 🚀 Guía Paso a Paso: TikTok Analytics → Google Sheets en n8n

## 📋 Tabla de Contenidos
1. [Configuración Inicial](#configuración-inicial)
2. [Crear el Workflow](#crear-el-workflow)
3. [Configurar Nodos](#configurar-nodos)
4. [Testing](#testing)
5. [Automatización Diaria](#automatización-diaria)

---

## 🔧 Configuración Inicial

### Paso 1: Verificar Credenciales de Google Sheets
1. En n8n, ve a **Credentials** (ícono de llave)
2. Busca o crea credenciales de **Google Sheets**
3. Autoriza tu cuenta de Google
4. Guarda el **Spreadsheet ID** (de la URL del sheet)

**Cómo obtener el Spreadsheet ID:**
```
URL: https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit#gid=0
                                            ^^^^^^^^^^^^^^^^
```

### Paso 2: Crear el Google Sheet
1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea un nuevo sheet llamado **"TikTok Analytics"**
3. En la primera fila (encabezados), agrega:
   - Fecha
   - Fecha ISO
   - Visualizaciones Videos
   - Visualizaciones Perfil
   - Me Gusta
   - Comentarios
   - Veces Compartido
   - Período
   - Fecha Extracción
   - Hora Extracción

---

## 🎯 Crear el Workflow

### Paso 3: Iniciar el Workflow en n8n

1. Click en **"+ Create a new workflow"**
2. Dale un nombre: **"TikTok to Google Sheets"**
3. Agrega los siguientes nodos en orden

---

## ⚙️ Configurar Nodos

### NODO 1: Schedule (Opcional - para automatización)

**Tipo:** Schedule

**Configuración:**
- Trigger type: **Every day**
- Hour: **8** (o la hora que prefieras)
- Minute: **0**
- Timezone: Tu zona horaria

*(Saltar este nodo si quieres ejecutar manualmente)*

---

### NODO 2: HTTP Request → TikTok API

**Tipo:** HTTP Request

**Configuración:**

| Campo | Valor |
|-------|-------|
| **URL** | `https://browserless-test.vercel.app/api/extract-tiktok` |
| **Method** | POST |
| **Headers** | `Content-Type: application/json` |

**Body (JSON):**
```json
{
  "tiktokCookies": {{ $('Cargar cookies').item.json.tiktok_cookies }},
  "period": "LAST_60D"
}
```

O si prefieres con variables:
```json
{
  "tiktokCookies": {{ $env.TIKTOK_COOKIES }},
  "period": "{{ $env.TIKTOK_PERIOD }}"
}
```

**Options:**
- ✅ Send Query Parameters as JSON
- ✅ Ignore SSL issues (si tienes certificados)

---

### NODO 3: Function - Transform Data

**Tipo:** Function (Core Nodes)

**Script:**
```javascript
// Obtener el JSON del request anterior
const requestData = $input.first().json;

console.log('📊 Transformando datos TikTok...');

// Validar datos
if (!requestData.success || !requestData.data?.metrics) {
  throw new Error('Invalid TikTok response');
}

const metrics = requestData.data.metrics;
const daysMap = new Map();

// Procesar cada métrica
Object.entries(metrics).forEach(([metricName, metricData]) => {
  if (!metricData.historicalData?.length) return;
  
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

// Convertir a array de filas
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
    'Fecha Extracción': new Date(requestData.data.timestamp).toISOString().split('T')[0]
  }));

return rows;
```

---

### NODO 4: Google Sheets - Append Data

**Tipo:** Google Sheets

**Configuración:**

| Campo | Valor |
|-------|-------|
| **Credentials** | Selecciona tu Google Sheets credential |
| **Operation** | Append (o Clear All & Write si quieres reemplazar) |
| **Spreadsheet ID** | Tu ID de sheet |
| **Sheet Name** | TikTok Analytics |
| **Column Names** | Deja que n8n auto-complete o escribe los nombres |

**En la sección de datos (Data to Write):**

1. Cada columna debe estar mapeada:
```
Fecha = {{ $json.Fecha }}
Fecha ISO = {{ $json['Fecha ISO'] }}
Visualizaciones Videos = {{ $json['Visualizaciones Videos'] }}
Visualizaciones Perfil = {{ $json['Visualizaciones Perfil'] }}
Me Gusta = {{ $json['Me Gusta'] }}
Comentarios = {{ $json['Comentarios'] }}
Veces Compartido = {{ $json['Veces Compartido'] }}
Período = {{ $json.Período }}
Fecha Extracción = {{ $json['Fecha Extracción'] }}
```

---

### NODO 5: Error Handling (Recomendado)

**Tipo:** Error Trigger → Send Email/Notification

**Si quieres saber si hay errores:**
```
Destinatario: tu@email.com
Asunto: ❌ Error en TikTok Analytics Sync
```

---

## ✅ Testing

### Paso 4: Probar el Workflow

1. **En el nodo HTTP Request:**
   - Click en el ícono de prueba (play)
   - Verifica que recibe datos correctamente

2. **En el nodo Function:**
   - Debería mostrar el JSON transformado
   - Verifica que tiene el número correcto de días

3. **En Google Sheets:**
   - Debe agregar/actualizar las filas
   - Las columnas deben estar ordenadas correctamente

4. **Full Test:**
   - Click en "Execute workflow" en la parte superior
   - Espera que se complete
   - Ve a Google Sheets y verifica

---

## 🔄 Automatización Diaria

### Paso 5: Activar Schedule

1. Si agregaste el nodo Schedule:
   - Click en "Activate" (parte superior derecha)
   - El workflow se ejecutará automáticamente todos los días a la hora indicada

2. Monitorear ejecuciones:
   - Ve a **Executions**
   - Verás un historial de cada corrida
   - Si hay errores, aparecerán en rojo

---

## 📊 Opciones Avanzadas

### Opción A: Append (Agregar filas)
```
Operation: Append
→ Cada día agrega nuevas filas sin borrar las anteriores
→ Usa esto para un historial completo
```

### Opción B: Clear & Write (Reemplazar)
```
Operation: Clear All & Write
→ Cada día borra todo y escribe desde cero
→ Usa esto para tener solo el período actual
```

### Opción C: Update Existing (Actualizar)
```
Operation: Update
→ Actualiza filas existentes basado en un criterio
→ Útil si quieres reemplazar datos del mismo día
```

---

## 🐛 Troubleshooting

### Error: "Invalid credentials"
- Ve a Credentials
- Re-autoriza Google Sheets
- Verifica que tienes permisos en el sheet

### Error: "Spreadsheet not found"
- Copia el ID correcto de la URL
- Verifica que la cuenta de Google tiene acceso

### Las columnas están en el orden incorrecto
- En el nodo Google Sheets
- Asegúrate que **Column Names** coincidan exactamente con los headers del sheet
- Usa el mismo nombre y orden

### Falta datos en algunas métricas
- Verifica que el período solicitado tiene datos
- Si es LAST_7D, solo habrá 7 días de datos
- Prueba con LAST_60D para más datos

---

## 📝 Ejemplo de Output en Google Sheets

```
Fecha          Fecha ISO    Vids  Perfil  Likes  Comentarios  Compartidos  Período   Fecha Extracción
2 de nov       2025-11-02   0     0       0      0            0            LAST_60D  2026-01-01
3 de nov       2025-11-03   2     1       0      0            0            LAST_60D  2026-01-01
4 de nov       2025-11-04   5     0       1      0            0            LAST_60D  2026-01-01
...
31 de dic      2025-12-31   11    0       3      1            0            LAST_60D  2026-01-01
```

---

## 🎉 ¡Listo!

Ahora tu workflow ejecutará automáticamente y subirá los datos de TikTok a Google Sheets cada día.

**Próximos pasos:**
- [ ] Crear dashboards en Google Sheets con gráficos
- [ ] Agregar gráficos de tendencias
- [ ] Integrar con otros datos (Facebook, Instagram, etc.)
- [ ] Crear alertas si las métricas caen

---

**¿Preguntas?** Revisa los logs en la sección de Executions en n8n para ver exactamente qué está pasando.
