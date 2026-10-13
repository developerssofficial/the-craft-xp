export default function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    return res.status(503).json({ 
      error: 'Supabase authentication service is not configured in server environment.' 
    });
  }

  return res.status(200).json({
    url,
    anonKey
  });
}
