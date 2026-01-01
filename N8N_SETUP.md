# Configuración N8N para Extract All Platforms

## 1. Pasos para obtener las cookies

### Facebook
1. Inicia sesión en Facebook.com
2. Abre DevTools (F12) → Application → Cookies → facebook.com
3. Selecciona TODAS las cookies y exporta (o copia manualmente)
4. Guarda como JSON array: 
```json
[
  {"name": "c_user", "value": "...", "domain": ".facebook.com", "path": "/", ...},
  {"name": "xs", "value": "...", "domain": ".facebook.com", "path": "/", ...}
]
```

### TikTok
1. Inicia sesión en TikTok.com
2. Abre DevTools (F12) → Application → Cookies → tiktok.com
3. Copia manualmente como objeto JSON:
```json
{
  "msToken": "...",
  "store-country-sign": "...",
  "last_login_method": "email",
  "sid_tt": "...",
  "sessionid": "..."
}
```

## 2. Configuración en n8n

### Node: Set (para guardar cookies)

**Node 1: Set - Facebook Cookies**
- Key: `meta_cookies`
- Type: `String`
- Value: (Copia y pega el JSON completo de Facebook tal cual)

**Node 2: Set - TikTok Cookies**
- Key: `tiktok_cookies`
- Type: `String`
- Value: (Copia y pega el JSON completo de TikTok tal cual)

### Node 3: HTTP Request (a Vercel)

**Method**: POST
**URL**: `https://your-vercel-domain.vercel.app/api/extract-all-platforms`

**Headers**:
```
Content-Type: application/json
```

**Body** (Raw JSON):
```json
{
  "cookies": {{$json.meta_cookies}},
  "tiktokCookies": {{$json.tiktok_cookies}},
  "period": "LAST_28D",
  "includeTikTok": true,
  "businessId": "176166689688823",
  "assetId": "8555156748"
}
```

## 3. Notas Importantes

⚠️ **El endpoint maneja automáticamente**:
- Cookies como strings (n8n los stringifica automáticamente)
- Cookies como arrays (Facebook)
- Cookies como objetos (TikTok)
- Doble stringificación (si n8n lo hace)

✅ **Simplemente**:
1. Pega los cookies en los Set nodes como strings
2. n8n los envía al POST
3. El endpoint los parsea automáticamente

## 4. Respuesta Esperada

```json
{
  "success": true,
  "data": {
    "timestamp": "2026-01-01T...",
    "period": "LAST_28D",
    "platforms": {
      "facebook": {
        "metrics": {...},
        "totalPoints": 168
      },
      "instagram": {
        "metrics": {...},
        "totalPoints": 168
      },
      "tiktok": {
        "visualizaciones_videos": "1234",
        "me_gusta": "456",
        ...
      }
    }
  }
}
```

## 5. Troubleshooting

Si ves error `"Cookies are required and must be valid JSON"`:

1. Asegúrate que los cookies en n8n sean strings válidos
2. Si copiastes desde DevTools, quizá falten comillas alrededor de valores
3. Prueba minificando el JSON: `jq -c .` en terminal

Para probar localmente:
```bash
curl -X POST http://localhost:3000/api/extract-all-platforms \
  -H "Content-Type: application/json" \
  -d @payload.json
```
