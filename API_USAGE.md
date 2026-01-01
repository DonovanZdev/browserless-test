# API Usage - Browserless Test

## Endpoint: `/api/extract-all-platforms`

### POST Request

**URL:**
```
https://tu-dominio.vercel.app/api/extract-all-platforms
```

### Request Body (JSON)

```json
{
  "cookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value",
      "domain": ".facebook.com",
      "path": "/"
    }
  ],
  "tiktokCookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value",
      "domain": ".tiktok.com",
      "path": "/"
    }
  ],
  "period": "LAST_28D",
  "includeTikTok": true,
  "businessId": "176166689688823",
  "assetId": "8555156748"
}
```

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `cookies` | Array\|String | Sí | Cookies de Facebook/Instagram (Meta). Pueden ser un string JSON o un array de objetos |
| `tiktokCookies` | Array\|String | No | Cookies de TikTok. Mismo formato que `cookies` |
| `period` | String | No | Período de extracción. Default: `LAST_28D` |
| `includeTikTok` | Boolean | No | Si incluir TikTok en la extracción. Default: `false` |
| `businessId` | String | No | ID del negocio de Facebook. Default: `176166689688823` |
| `assetId` | String | No | ID del asset (página/cuenta). Default: `8555156748` |

### Períodos Soportados

- `LAST_7D` - Últimos 7 días
- `LAST_28D` - Últimos 28 días ✅ (Recomendado)
- `LAST_90D` - Últimos 90 días
- `THIS_MONTH` - Este mes
- `LAST_MONTH` - Mes anterior

### Response - Success (200)

```json
{
  "success": true,
  "data": {
    "data": {
      "timestamp": "2026-01-01T07:14:17.318Z",
      "period": "LAST_28D",
      "platforms": {
        "facebook": {
          "platform": "Facebook",
          "period": "LAST_28D",
          "extractedAt": "2026-01-01T07:14:33.064Z",
          "metrics": {
            "Visualizaciones": {
              "totalValue": "",
              "totalPoints": 28,
              "historicalData": [
                {
                  "fecha": "3 de dic",
                  "valor": "19161496",
                  "timestamp": 1764748800,
                  "date": "2025-12-03"
                }
              ]
            }
          }
        },
        "instagram": {
          "platform": "Instagram",
          "period": "LAST_28D",
          "extractedAt": "2026-01-01T07:14:45.123Z",
          "metrics": {
            "Visualizaciones": {
              "totalValue": "",
              "totalPoints": 28,
              "historicalData": [...]
            }
          }
        },
        "tiktok": {
          "visualizaciones_videos": "40",
          "visualizaciones_perfil": "5",
          "me_gusta": "3",
          "comentarios": "1",
          "veces_compartido": "0",
          "recompensas_estimadas": "$0",
          "periodo": "Los últimos 28 días"
        }
      }
    }
  }
}
```

### Response - Error (4xx/5xx)

```json
{
  "success": false,
  "error": "Descripción del error"
}
```

---

## Uso en n8n

### Opción 1: Cookies como String JSON (desde variable n8n)

Si en n8n tienes las cookies como un string JSON (ej: `$json.meta_cookies`):

```json
{
  "cookies": "$json.meta_cookies",
  "tiktokCookies": "$json.tiktok_cookies",
  "period": "LAST_28D",
  "includeTikTok": true
}
```

### Opción 2: Cookies como Array (parseadas en n8n)

Si necesitas parsearlas primero en n8n:

```javascript
// En Code Node de n8n:
const metaCookies = typeof $json.meta_cookies === 'string' 
  ? JSON.parse($json.meta_cookies) 
  : $json.meta_cookies;

const tiktokCookies = typeof $json.tiktok_cookies === 'string'
  ? JSON.parse($json.tiktok_cookies)
  : $json.tiktok_cookies;

return {
  cookies: metaCookies,
  tiktokCookies: tiktokCookies,
  period: 'LAST_28D',
  includeTikTok: true
};
```

### Opción 3: Pasar como variables de n8n (Recomendado)

En la configuración HTTP POST de n8n:

**URL:** `https://tu-dominio.vercel.app/api/extract-all-platforms`

**Body:**
```json
{
  "cookies": "{{$json.meta_cookies}}",
  "tiktokCookies": "{{$json.tiktok_cookies}}",
  "period": "LAST_28D",
  "includeTikTok": true
}
```

El endpoint automáticamente detectará si son strings o arrays y los procesará correctamente.

---

## Notas Importantes

⚠️ **NO incluyas cookies en el código o GitHub** - Úsalas como variables de entorno o variables de workflow en n8n

⚠️ **Timeout**: El endpoint tiene 600 segundos de timeout máximo. La extracción normalmente toma 30-60 segundos.

✅ **Meta Cookies**: Las mismas cookies funcionan para Facebook e Instagram

✅ **TikTok Cookies**: Requiere cookies separadas de `.tiktok.com`

---

## Testing Local

```bash
# Con curl
curl -X POST http://localhost:3000/api/extract-all-platforms \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "cookies": [{"name":"c","value":"v","domain":".facebook.com","path":"/"}],
  "period": "LAST_28D",
  "includeTikTok": false
}
EOF

# Con Node.js
node test-multi-platform.js
```
