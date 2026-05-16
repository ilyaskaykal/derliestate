import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VERIFY_TOKEN = "derli2026facebook";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return new Response(challenge || "", { status: 200, headers: corsHeaders });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    if (req.method === "POST") {
      const data = await req.json();
      const leads = data?.entry?.[0]?.changes?.[0]?.value?.leads || [];

      for (const lead of leads) {
        const fields: Record<string, string> = {};
        (lead.field_data || []).forEach((f: { name: string; values: string[] }) => {
          fields[f.name] = f.values?.[0] || "";
        });

        const fullName = fields.full_name || "";
        const parts = fullName.trim().split(" ");
        const ad = fields.first_name || parts[0] || "Bilinmiyor";
        const soyad = fields.last_name || parts.slice(1).join(" ") || "";

        await fetch(`${supabaseUrl}/rest/v1/musteriler`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            ad,
            soyad,
            telefon: fields.phone_number || "",
            email: fields.email || "",
            notlar: `Facebook/Instagram Lead Ads - Kampanya: ${lead.ad_name || "Bilinmiyor"}`,
            durum: "kararsiz",
            kaynak: "facebook_lead",
            muhit: "",
            butce: "",
            butce_min: "",
            butce_max: "",
            aciklama: "",
            portfoy_tercihi: "",
            olmaz_olmaz: "",
            kesin_istekler: "",
            danisman: "",
            bolge_esnek: false,
          }),
        });
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
