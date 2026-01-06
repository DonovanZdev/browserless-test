const https = require('https');
const { URL } = require('url');
const fs = require('fs');

// CSV data for November 2025 (Video Views only)
const novemberCSV = [0, 0, 0, 1, 0, 4, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2, 0, 1, 0, 1, 0];

function parseCookies(cookies) {
  if (!cookies) return '';
  
  if (typeof cookies === 'string') {
    try {
      let cookieString = cookies.trim();
      if ((cookieString.startsWith('"') && cookieString.endsWith('"')) ||
          (cookieString.startsWith("'") && cookieString.endsWith("'"))) {
        cookieString = cookieString.slice(1, -1);
      }
      cookies = JSON.parse(cookieString);
    } catch (e) {
      return '';
    }
  }

  let cookieString = '';
  
  if (Array.isArray(cookies)) {
    if (cookies[0] && cookies[0].name && cookies[0].value) {
      cookieString = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } else if (typeof cookies[0] === 'object' && !cookies[0].name) {
      const cookieObj = cookies[0];
      cookieString = Object.entries(cookieObj)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
  } else if (typeof cookies === 'object') {
    cookieString = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
  
  return cookieString;
}

async function makeRequest(url, cookieHeader) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        'Referer': 'https://www.tiktok.com/',
        'Cookie': cookieHeader
      }
    };

    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    request.on('error', (e) => {
      reject(e);
    });

    request.end();
  });
}

async function testEndDays(cookies, endDaysValue) {
  try {
    const cookieHeader = parseCookies(cookies);
    if (!cookieHeader) throw new Error('No valid cookies');

    // For November from January 6, 2026
    const now = new Date('2026-01-06');
    now.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(2025, 10, 30); // Nov 30, 2025
    targetDate.setHours(0, 0, 0, 0);
    
    const daysBack = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));
    
    const typeRequests = [
      { "insigh_type": "vv_history", "days": daysBack, "end_days": endDaysValue }
    ];

    const baseUrl = "https://www.tiktok.com/aweme/v2/data/insight/";
    const params = new URLSearchParams({
      locale: "en",
      aid: "1988",
      priority_region: "MX",
      tz_name: "America/Mexico_City",
      app_name: "tiktok_creator_center",
      app_language: "en",
      device_platform: "web_pc",
      channel: "tiktok_web",
      device_id: "7586552972738463288",
      os: "win",
      tz_offset: "-6",
      type_requests: JSON.stringify(typeRequests)
    });

    const url = `${baseUrl}?${params.toString()}`;
    const result = await makeRequest(url, cookieHeader);

    if (result.status_code !== 0) {
      throw new Error(`API error: ${result.status_msg}`);
    }

    const vvValues = (result.vv_history || [])
      .filter(item => item && item.status === 0)
      .map(item => item.value || 0);

    // Get first 30 values (November has 30 days)
    const first30 = vvValues.slice(0, 30);

    // Compare with CSV
    let matches = 0;
    let diff = [];
    for (let i = 0; i < 30; i++) {
      if (i < first30.length) {
        if (first30[i] === novemberCSV[i]) {
          matches++;
        } else {
          diff.push(`Day ${i + 1}: CSV=${novemberCSV[i]} API=${first30[i]}`);
        }
      }
    }

    console.log(`\n📊 end_days = ${endDaysValue}`);
    console.log(`✅ Days: ${daysBack}, Total matches: ${matches}/30`);
    if (matches === 30) {
      console.log('🎉 PERFECT MATCH!');
    } else {
      console.log('First 10 values:');
      console.log(`  CSV: [${novemberCSV.slice(0, 10).join(', ')}]`);
      console.log(`  API: [${first30.slice(0, 10).join(', ')}]`);
      if (diff.length <= 10) {
        console.log('Differences:', diff.join(', '));
      }
    }

    return { endDaysValue, matches, first30 };
  } catch (err) {
    console.error(`❌ end_days = ${endDaysValue}: ${err.message}`);
    return null;
  }
}

async function main() {
  const cookieFile = fs.readFileSync('/Users/donovanadrian/browserless-test/tiktok-cookies.json', 'utf8');
  const cookies = JSON.parse(cookieFile);

  console.log('🔍 Testing different end_days values for November 2025...\n');
  console.log(`📅 Target: November 2025 (Nov 1-30)`);
  console.log(`📍 Query date: January 6, 2026`);
  console.log(`📊 Expected (CSV): [${novemberCSV.slice(0, 10).join(', ')}] ... (first 10 days)\n`);

  // Test multiple end_days values
  for (let endDays = -5; endDays <= 35; endDays++) {
    await testEndDays(cookies, endDays);
  }
}

main().catch(console.error);
