// n8n Function Node - TikTok Cookie Expiration Analyzer
// Input: Array of cookies from TikTok
// Output: Expiration status and warnings

const now = new Date();
const nowTimestamp = now.getTime() / 1000; // Convert to Unix timestamp (seconds)

// Process cookies
const cookies = $json; // Expected to be an array of cookie objects

if (!Array.isArray(cookies)) {
  throw new Error('Input must be an array of cookies');
}

// Filter cookies with real expiration dates (not session cookies)
const expiringCookies = cookies
  .filter(cookie => !cookie.session && cookie.expirationDate)
  .map(cookie => {
    const expirationDate = new Date(cookie.expirationDate * 1000);
    const secondsUntilExpiry = cookie.expirationDate - nowTimestamp;
    const daysUntilExpiry = secondsUntilExpiry / (60 * 60 * 24);
    const isExpired = secondsUntilExpiry <= 0;
    const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    
    return {
      name: cookie.name,
      domain: cookie.domain,
      expirationDate: expirationDate.toISOString(),
      expirationDateFormatted: expirationDate.toLocaleString('es-MX'),
      secondsUntilExpiry: Math.round(secondsUntilExpiry),
      daysUntilExpiry: daysUntilExpiry.toFixed(2),
      isExpired: isExpired,
      isExpiringSoon: isExpiringSoon,
      status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'VALID'
    };
  })
  .sort((a, b) => a.expirationDate - b.expirationDate);

// Session cookies (never expire)
const sessionCookies = cookies
  .filter(cookie => cookie.session)
  .map(cookie => ({
    name: cookie.name,
    domain: cookie.domain,
    status: 'SESSION',
    expirationDate: 'Never (session cookie)'
  }));

// Find the cookie that expires first
const soonestExpiring = expiringCookies.length > 0 
  ? expiringCookies[0] 
  : null;

// Find expired cookies
const expiredCookies = expiringCookies.filter(c => c.isExpired);

// Find cookies expiring in next 7 days
const expiringInWeek = expiringCookies.filter(c => c.isExpiringSoon);

// Summary
const summary = {
  analysisTimestamp: now.toISOString(),
  analysisTimestampFormatted: now.toLocaleString('es-MX'),
  totalCookies: cookies.length,
  sessionCookies: sessionCookies.length,
  expiringCookies: expiringCookies.length,
  expiredCookies: expiredCookies.length,
  expiringInWeek: expiringInWeek.length,
  
  // Alert information
  alerts: {
    hasExpiredCookies: expiredCookies.length > 0,
    hasExpiringCookies: expiringInWeek.length > 0,
    status: expiredCookies.length > 0 
      ? 'ALERT: Some cookies have expired!' 
      : expiringInWeek.length > 0 
      ? 'WARNING: Some cookies expiring within 7 days' 
      : 'All cookies are valid'
  },
  
  // Soonest expiring
  soonestExpiring: soonestExpiring 
    ? {
        name: soonestExpiring.name,
        domain: soonestExpiring.domain,
        expirationDate: soonestExpiring.expirationDateFormatted,
        daysUntilExpiry: parseFloat(soonestExpiring.daysUntilExpiry),
        status: soonestExpiring.status
      }
    : null,
  
  // Details
  details: {
    expired: expiredCookies.map(c => ({
      name: c.name,
      domain: c.domain,
      expiredDate: c.expirationDateFormatted,
      daysOverdue: Math.abs(parseFloat(c.daysUntilExpiry)).toFixed(2)
    })),
    expiringInWeek: expiringInWeek.map(c => ({
      name: c.name,
      domain: c.domain,
      expirationDate: c.expirationDateFormatted,
      daysRemaining: parseFloat(c.daysUntilExpiry)
    })),
    session: sessionCookies
  },
  
  // Full detailed list
  all: {
    expiring: expiringCookies,
    session: sessionCookies
  }
};

// Console output for n8n debugging
console.log('🍪 TIKTOK COOKIE EXPIRATION ANALYSIS');
console.log('=====================================');
console.log(`Analyzed at: ${summary.analysisTimestampFormatted}`);
console.log(`Total cookies: ${summary.totalCookies}`);
console.log(`  - Session cookies: ${summary.sessionCookies}`);
console.log(`  - Expiring cookies: ${summary.expiringCookies}`);
console.log(`  - Expired cookies: ${expiredCookies.length}`);
console.log(`  - Expiring in 7 days: ${expiringInWeek.length}`);
console.log('');
console.log(`⚠️  Status: ${summary.alerts.status}`);
console.log('');

if (summary.soonestExpiring) {
  console.log(`🔴 SOONEST EXPIRING:`);
  console.log(`   Cookie: ${summary.soonestExpiring.name}`);
  console.log(`   Domain: ${summary.soonestExpiring.domain}`);
  console.log(`   Expires: ${summary.soonestExpiring.expirationDate}`);
  console.log(`   Days remaining: ${summary.soonestExpiring.daysUntilExpiry}`);
  console.log('');
}

if (expiredCookies.length > 0) {
  console.log(`❌ EXPIRED COOKIES (${expiredCookies.length}):`);
  expiredCookies.forEach(c => {
    console.log(`   - ${c.name} (expired ${Math.abs(parseFloat(c.daysUntilExpiry)).toFixed(2)} days ago)`);
  });
  console.log('');
}

if (expiringInWeek.length > 0) {
  console.log(`⏰ EXPIRING SOON - Next 7 days (${expiringInWeek.length}):`);
  expiringInWeek.forEach(c => {
    console.log(`   - ${c.name}: ${parseFloat(c.daysUntilExpiry).toFixed(2)} days (${c.expirationDateFormatted})`);
  });
  console.log('');
}

return summary;
