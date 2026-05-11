import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.rawQuery || '');
    const verifyToken = params.get('hub.verify_token');
    const challenge = params.get('hub.challenge');
    const mode = params.get('hub.mode');

    if (mode === 'subscribe' && verifyToken === (process.env.FB_VERIFY_TOKEN || 'derli2026facebook')) {
      return { statusCode: 200, headers: corsHeaders, body: challenge || '' };
    }
    return { statusCode: 403, headers: corsHeaders, body: 'Forbidden' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body || '{}');
      const leads = data.entry?.[0]?.changes?.[0]?.value?.leads || [];

      for (const lead of leads) {
        const fields: Record<string, string> = {};
        lead.field_data?.forEach((f: { name: string; values: string[] }) => {
          fields[f.name] = f.values[0];
        });

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) continue;

        const isInstagram = lead.ad_name?.toLowerCase().includes('instagram') ||
          data.entry?.[0]?.changes?.[0]?.value?.platform === 'instagram';

        await fetch(`${supabaseUrl}/rest/v1/musteriler`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            ad: fields.first_name || fields.full_name?.split(' ')[0] || 'Bilinmiyor',
            soyad: fields.last_name || fields.full_name?.split(' ').slice(1).join(' ') || '',
            telefon: fields.phone_number || '',
            email: fields.email || '',
            notlar: `${isInstagram ? 'Instagram' : 'Facebook'} Lead Ads'ten geldi. Kampanya: ${lead.ad_name || 'Bilinmiyor'}`,
            durum: 'dusunuyor',
            kaynak: isInstagram ? 'instagram_lead' : 'facebook_lead',
            created_at: new Date().toISOString(),
          }),
        });
      }

      return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    } catch (err) {
      console.error('Facebook lead error:', err);
      return { statusCode: 500, headers: corsHeaders, body: 'Error' };
    }
  }

  return { statusCode: 405, headers: corsHeaders, body: 'Method not allowed' };
};
