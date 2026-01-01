# ✅ SOLUCIÓN DEFINITIVA: N8N + Extract All Platforms

## El Problema (RESUELTO)
- Facebook cookies llegan como **array** (formato navegador)
- TikTok cookies llegan como **objeto** (formato manual o export)
- n8n los stringifica de forma diferente
- El endpoint no podía parsearlos correctamente

## La Solución
El endpoint ahora es **ultra tolerante** y parsea automáticamente:
- Strings JSON (incluso doble stringificados)
- Arrays
- Objetos
- Combinaciones

## 🚀 Pasos para Hacer Funcionar en N8N

### 1. Generar los Cookies Normalizados
```bash
cd /Users/donovanadrian/browserless-test
node normalize-cookies-for-n8n.js
```

Esto genera:
- `n8n-cookies-config.json` - Cookies en formato JSON
- `n8n-test-payload.json` - Payload de ejemplo

### 2. Configurar N8N (Paso a Paso)

#### Node 1: "Set - Meta Cookies"
```
Type: Set
- Name: Set Meta Cookies
- Assignments:
  - Key: meta_cookies
  - Type: String
  - Value: [PEGA AQUÍ LOS FACEBOOK COOKIES COMO STRING]
```

**Para obtener el string de Facebook:**
```bash
cat n8n-cookies-config.json | jq -r '.meta_cookies_n8n'
```

Copia el OUTPUT completo y pégalo en el Value.

#### Node 2: "Set - TikTok Cookies"
```
Type: Set
- Name: Set TikTok Cookies
- Assignments:
  - Key: tiktok_cookies
  - Type: String
  - Value: [PEGA AQUÍ LOS TIKTOK COOKIES COMO STRING]
```

**Para obtener el string de TikTok:**
```bash
cat n8n-cookies-config.json | jq -r '.tiktok_cookies_n8n'
```

Copia el OUTPUT completo y pégalo en el Value.

#### Node 3: "HTTP Request - Extract All Platforms"
```
Method: POST
URL: https://browserless-test.vercel.app/api/extract-all-platforms

Headers:
- Content-Type: application/json

Body (Raw):
{
  "cookies": {{$json.meta_cookies}},
  "tiktokCookies": {{$json.tiktok_cookies}},
  "period": "LAST_28D",
  "businessId": "176166689688823",
  "assetId": "8555156748",
  "includeTikTok": true
}
```

### 3. Configuración Recomendada de n8n

**En Settings:**
```
Timeout: 300000 (5 minutos)
Retry on Failure: Enabled (Max Retries: 2)
```

Porque Facebook e Instagram tardan ~2-3 minutos cada una.

## ✅ Validación Local (Antes de Desplegar)

```bash
# Generar payload de prueba
node normalize-cookies-for-n8n.js

# Test local
node test-n8n-payload.js

# Verás output como este:
# ✅ Facebook: 28 puntos
# ✅ Instagram: 28 puntos (o menos si no hay datos)
# ✅ TikTok: completado
# ✅ Éxito! Resultado: {...}
```

## 📊 Respuesta Esperada

```json
{
  "success": true,
  "data": {
    "timestamp": "2026-01-01T08:05:19.324Z",
    "period": "LAST_28D",
    "platforms": {
      "facebook": {
        "metrics": {
          "Visualizaciones": {"totalValue": "...", "historicalData": [...]},
          "Espectadores": {...},
          "Interacciones": {...},
          "Clics enlace": {...},
          "Visitas": {...},
          "Seguidores": {...}
        }
      },
      "instagram": {
        "metrics": {
          "Visualizaciones": {...},
          "Espectadores": {...},
          ...
        }
      },
      "tiktok": {
        "visualizaciones_videos": "1234",
        "visualizaciones_perfil": "456",
        "me_gusta": "789",
        "comentarios": "123",
        "veces_compartido": "45",
        "recompensas_estimadas": "$678"
      }
    }
  }
}
```

## 🔧 Si Algo Sale Mal

### Error: "Cookies are required and must be valid JSON"
- ✅ Asegúrate que copiaste el STRING COMPLETO (sin truncar)
- ✅ Verifica que no haya caracteres raros en el copy-paste
- ✅ Usa `cat n8n-cookies-config.json | jq -r '.meta_cookies_n8n' | wc -c` para contar caracteres

### Error: Timeout
- ✅ Aumenta timeout a 300000 (5 min) en n8n Settings
- ✅ Es normal que tarde 2-3 minutos por cada plataforma

### Error: "res.status is not a function"
- ✅ Este era el error anterior, ya está RESUELTO en el nuevo endpoint

## 📝 Notas Técnicas

**¿Qué cambió en el endpoint?**

```javascript
// Nuevo: función normalizeCookies que maneja múltiples formatos
function normalizeCookies(input) {
  if (!input) return null;
  
  let parsed = input;
  
  // Si es string, parsearlo recursivamente (soporta doble stringificación)
  if (typeof input === 'string') {
    let attempts = 0;
    while (typeof parsed === 'string' && attempts < 5) {
      try {
        parsed = JSON.parse(parsed);
        attempts++;
      } catch (e) {
        break;
      }
    }
  }
  
  return parsed; // Ya es objeto/array, listo para parseCookies()
}
```

**¿Cómo Puppeteer recibe los cookies?**
1. Facebook cookies: Array de objetos con {name, value, domain, path, ...}
2. TikTok cookies: Se convierten de objeto {"key": "value"} a array de {name, value}

Ambos formatos son soportados automáticamente.

## 🎯 Próximos Pasos

1. ✅ Ejecuta `node normalize-cookies-for-n8n.js`
2. ✅ Copia los valores a n8n (3 nodes como arriba)
3. ✅ Test local con `node test-n8n-payload.js`
4. ✅ Prueba en n8n workflow
5. ✅ Programa automatización

**¿Preguntas?** Revisa:
- `n8n-test-payload.json` - Ejemplo de payload correcto
- `api/extract-all-platforms.js` - Código del endpoint (línea ~295 en adelante)
- `normalize-cookies-for-n8n.js` - Script de generación
