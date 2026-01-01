# 📊 TikTok Analytics → Google Sheets - Guía Rápida

## 🎯 Lo que haremos

Cada día, n8n:
1. ✅ Llama tu API de TikTok (browserless-test.vercel.app)
2. ✅ Obtiene los últimos 60 días de analytics
3. ✅ Transforma los datos a formato tabla
4. ✅ Sube todo a tu Google Sheet automáticamente

---

## 📁 Archivos de Referencia en tu Repo

- **`N8N_GOOGLE_SHEETS_SETUP_COMPLETO.md`** ← GUÍA PASO A PASO COMPLETA
- **`n8n-transform-to-sheets.js`** ← Script para el nodo Function
- **`N8N_SETUP_FINAL.md`** ← Docs previos de n8n

---

## ⚡ Quick Start (5 minutos)

### 1. En Google Sheets
```
1. Crea un sheet nuevo llamado "TikTok Analytics"
2. Primera fila (encabezados):
   
   A            B           C                    D                    E         F            G
   Fecha        Fecha ISO   Vids Videos          Vids Perfil          Me Gusta  Comentarios  Compartidos
```

### 2. En n8n - Crear Workflow

**Nodo 1: Schedule** (opcional)
```
Every day at 8 AM
```

**Nodo 2: HTTP Request**
```
POST https://browserless-test.vercel.app/api/extract-tiktok

Body JSON:
{
  "tiktokCookies": {{ $('paso_anterior').item.json.tiktok_cookies }},
  "period": "LAST_60D"
}
```

**Nodo 3: Function**
```javascript
const data = $input.first().json;
const metrics = data.data.metrics;
const daysMap = new Map();

Object.entries(metrics).forEach(([name, metric]) => {
  if (!metric.historicalData?.length) return;
  metric.historicalData.forEach((day) => {
    if (!daysMap.has(day.date)) {
      daysMap.set(day.date, {fecha: day.fecha, date: day.date, ts: day.timestamp});
    }
    daysMap.get(day.date)[name] = day.valor;
  });
});

return Array.from(daysMap.values())
  .sort((a,b) => a.ts - b.ts)
  .map(d => ({
    'Fecha': d.fecha,
    'Fecha ISO': d.date,
    'Visualizaciones Videos': parseInt(d.visualizaciones_videos || 0),
    'Visualizaciones Perfil': parseInt(d.visualizaciones_perfil || 0),
    'Me Gusta': parseInt(d.me_gusta || 0),
    'Comentarios': parseInt(d.comentarios || 0),
    'Veces Compartido': parseInt(d.veces_compartido || 0)
  }));
```

**Nodo 4: Google Sheets**
```
Operation: Clear All & Write
Spreadsheet ID: [TU_ID_AQUI]
Sheet Name: TikTok Analytics

Mapeo de columnas:
Fecha              → {{ $json.Fecha }}
Fecha ISO          → {{ $json['Fecha ISO'] }}
Vids Videos        → {{ $json['Visualizaciones Videos'] }}
Vids Perfil        → {{ $json['Visualizaciones Perfil'] }}
Me Gusta           → {{ $json['Me Gusta'] }}
Comentarios        → {{ $json['Comentarios'] }}
Compartidos        → {{ $json['Veces Compartido'] }}
```

### 3. Test & Activate
```
1. Click "Execute Workflow"
2. Espera a que complete
3. Ve a Google Sheets y verifica
4. Si todo funciona, click "Activate" (parte superior derecha)
```

---

## 📊 Estructura de Datos

### Input del API:
```json
{
  "success": true,
  "data": {
    "period": "LAST_60D",
    "daysRequested": 60,
    "metrics": {
      "visualizaciones_videos": {
        "totalValue": "55",
        "historicalData": [
          {"fecha": "2 de nov", "valor": "0", "date": "2025-11-02"},
          {"fecha": "3 de nov", "valor": "2", "date": "2025-11-03"}
        ]
      },
      // ... más métricas
    }
  }
}
```

### Output para Google Sheets:
```
[
  {
    "Fecha": "2 de nov",
    "Fecha ISO": "2025-11-02",
    "Visualizaciones Videos": 0,
    "Visualizaciones Perfil": 0,
    "Me Gusta": 0,
    "Comentarios": 0,
    "Veces Compartido": 0
  },
  ...
]
```

---

## 🔐 Credenciales

**Ya tienes:**
- ✅ Credenciales de Google Sheets (dices que las tienes)
- ✅ Cookies de TikTok (en formato JSON)
- ✅ URL del API (https://browserless-test.vercel.app/api/extract-tiktok)

**Solo necesitas:**
- Spreadsheet ID del Google Sheet
- Nombre del sheet donde guardar

---

## 🎨 Después de crear la tabla

### Agregar gráficos en Google Sheets:
1. Selecciona los datos (columna de Fechas + Visualizaciones)
2. Insert → Chart
3. Elige tipo: Line Chart (Gráfico de líneas)
4. Personaliza

### Crear tabla dinámica:
1. Data → Pivot Table
2. Rows: Fecha
3. Values: Suma de Visualizaciones
4. Observa tendencias

### Fórmulas útiles:
```
Total de vistas:
=SUM(C:C)

Promedio diario:
=AVERAGE(C:C)

Máximo en un día:
=MAX(C:C)

Fecha del máximo:
=INDEX(A:A, MATCH(MAX(C:C), C:C, 0))
```

---

## ⚙️ Opciones Avanzadas

### Agregar más períodos:
```javascript
{
  "tiktokCookies": {{ $('Cargar cookies').item.json.tiktok_cookies }},
  "period": "{{ $env.PERIOD || 'LAST_60D' }}"
}
```

### Ejecutar múltiples períodos:
```
Nodo 1: Schedule
Nodo 2-4: HTTP + Function + Sheets (LAST_7D)
Nodo 5-7: HTTP + Function + Sheets (LAST_28D)
Nodo 8-10: HTTP + Function + Sheets (LAST_60D)

Diferentes sheets o tabs para cada período
```

### Notificaciones:
```
Si falla, enviar email:
Error Trigger → Send Email
"Error en sync de TikTok: {{ $error.message }}"
```

---

## ✅ Checklist Final

- [ ] Google Sheet creado con nombre "TikTok Analytics"
- [ ] Encabezados creados en primera fila
- [ ] Credenciales de Google Sheets en n8n
- [ ] Workflow creado en n8n con 4 nodos
- [ ] Test ejecutado exitosamente
- [ ] Datos aparecen en Google Sheets
- [ ] Workflow activado para ejecución automática
- [ ] Schedule configurado (si usas automatización)

---

## 🆘 Errores Comunes

| Error | Solución |
|-------|----------|
| "Invalid credentials" | Re-autoriza Google en Credentials |
| "Spreadsheet not found" | Verifica Spreadsheet ID |
| "Column not found" | Nombres de columnas no coinciden |
| "No data received" | Verifica cookies de TikTok, pueden estar expiradas |
| "Appends empty rows" | Usa "Clear All & Write" en lugar de "Append" |

---

## 📞 Soporte

**Revisar en n8n:**
1. Executions → Tu workflow → Ver logs completos
2. Cada nodo tiene output que puedes inspeccionar
3. Usa console.log() en Function para debugging

---

¡Listo para empezar! 🚀
