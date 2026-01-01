# Facebook Metrics API - Parámetros Dinámicos

## Endpoint
```
POST /api/extract
```

## Parámetros de Período Soportados

### Facebook (`facebook_period`)
- `LAST_7D` - Últimos 7 días
- `LAST_14D` - Últimos 14 días
- `LAST_28D` - Últimos 28 días (DEFAULT)
- `THIS_MONTH` - Este mes
- `LAST_MONTH` - Mes pasado
- `LAST_3_MONTHS` - Últimos 3 meses
- Otro formato de Facebook

### TikTok (`tiktok_period`)
- `7` - Últimos 7 días (DEFAULT)
- `14` - Últimos 14 días
- `28` - Últimos 28 días
- Cualquier número de días

## Ejemplo de Request desde n8n

```json
{
  "meta_cookies": [
    {
      "name": "c_user",
      "value": "123456789",
      "domain": ".facebook.com"
    }
  ],
  "tiktok_cookies": {
    "sessionid": "abc123def456"
  },
  "platform": "facebook",
  "facebook_period": "LAST_28D",
  "tiktok_period": 28
}
```

## Respuesta

```json
{
  "success": true,
  "data": {
    "facebook": {
      "visualizaciones": "518600000",
      "espectadores": "29800000",
      "interacciones": "3400000",
      "clics_enlace": "89200",
      "visitas": "2500000",
      "seguidores": "37200",
      "periodo": "3 de dic - 30 de dic"
    }
  }
}
```

## Cómo usar en n8n

1. En el nodo **HTTP Request**:
   - **Method**: POST
   - **URL**: Tu URL de Vercel (ej: https://browserless-test.vercel.app/api/extract)
   - **Headers**: `Content-Type: application/json`
   - **Body**: 
   ```json
   {
     "meta_cookies": {{$json.cookies}},
     "platform": "facebook",
     "facebook_period": {{$json.period}}
   }
   ```

2. **Pasar el período desde n8n**:
   - En tu workflow, crea una variable `period` con el valor deseado
   - El endpoint lo usará automáticamente
