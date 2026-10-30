module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error: 'Use POST to sign up.'});
  }
  if (req.headers.origin && req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== `http://${req.headers.host}`) {
    return res.status(403).json({error: 'Submit from the Pearl & Leaf website.'});
  }
  if (!req.headers['content-type']?.startsWith('application/json')) {
    return res.status(415).json({error: 'Invalid submission format.'});
  }
  if (Number(req.headers['content-length']) > 1024) {
    return res.status(413).json({error: 'Submission is too large.'});
  }

  let webhook;
  try {
    webhook = new URL(process.env.GHL_WEBHOOK_URL);
    if (webhook.protocol !== 'https:' || webhook.hostname !== 'services.leadconnectorhq.com') throw new Error('INVALID_WEBHOOK');
  } catch {
    return res.status(503).json({error: 'Signups are temporarily unavailable. Please try again later.'});
  }

  let email;
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || JSON.stringify(data).length > 1024) throw new Error('INVALID_BODY');
    email = typeof data.email === 'string' ? data.email.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
  } catch {
    return res.status(400).json({error: 'Enter a valid email address.'});
  }

  try {
    const upstream = await fetch(webhook, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, source: 'pearl & leaf website', form: 'opening notify', brand: 'pearl & leaf'}),
      redirect: 'error',
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) {
      console.error('Pearl & Leaf GHL delivery failed with status', upstream.status);
      return res.status(502).json({error: 'We could not confirm your signup. Please try again later.'});
    }
    return res.status(200).json({ok: true});
  } catch (error) {
    console.error('Pearl & Leaf GHL delivery failed', error?.name || 'Unknown error');
    return res.status(502).json({error: 'We could not confirm your signup. Please try again later.'});
  }
};
