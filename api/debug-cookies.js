// Vercel serverless handler para debug
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = req.body;
    
    return res.status(200).json({
      success: true,
      debug: {
        received: {
          type: typeof rawBody.tiktokCookies,
          isString: typeof rawBody.tiktokCookies === 'string',
          isArray: Array.isArray(rawBody.tiktokCookies),
          isObject: typeof rawBody.tiktokCookies === 'object',
          length: typeof rawBody.tiktokCookies === 'string' ? rawBody.tiktokCookies.length : 'N/A',
          firstChars: typeof rawBody.tiktokCookies === 'string' ? rawBody.tiktokCookies.slice(0, 100) : 'N/A',
          firstObject: Array.isArray(rawBody.tiktokCookies) ? rawBody.tiktokCookies[0] : rawBody.tiktokCookies
        },
        period: rawBody.period
      },
      message: 'Debug info - revisa la sección "debug" para ver qué llegó'
    });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      error: error.message,
      success: false
    });
  }
};
