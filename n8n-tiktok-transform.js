// N8N JavaScript Node - SIMPLIFIED
// El backend ya retorna datos completamente transformados
// Solo pasamos los datos tal cual

// Intentar obtener los datos del API
let input;
if ($json && $json.metrics) {
  input = $json;
} else if ($json && Array.isArray($json) && $json[0] && $json[0].metrics) {
  input = $json[0];
} else if (typeof data !== 'undefined' && data && data.body) {
  input = Array.isArray(data.body) ? data.body[0] : data.body;
} else if (typeof data !== 'undefined' && data && data.metrics) {
  input = data;
} else {
  throw new Error('Invalid input: missing metrics');
}

// Los datos ya vienen completamente transformados desde el backend
return input;
