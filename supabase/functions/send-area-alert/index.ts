/// <reference path="../remote-imports.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const OVERPRICE_PCT = Number(Deno.env.get('OVERPRICE_THRESHOLD') || '10')

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function overpricedLines(
  avgs: Array<{ product: string; avg_price: number | string }>,
  refMap: Record<string, number>
): string[] {
  const lines: string[] = []
  for (const a of avgs || []) {
    const ref = refMap[a.product]
    if (ref == null) continue
    const avg = Number(a.avg_price)
    if (!avg || !ref) continue
    const pct = ((avg - ref) / ref) * 100
    if (pct > OVERPRICE_PCT) {
      lines.push(
        `${a.product}: avg ${avg.toFixed(2)} vs reference ${ref.toFixed(2)} (${pct.toFixed(1)}% above reference)`
      )
    }
  }
  return lines
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    })
    const {
      data: { user },
      error: userErr
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: staffRow, error: staffErr } = await admin
      .from('staff_profiles')
      .select('is_super_admin, can_manage_area_monitors')
      .eq('user_id', user.id)
      .maybeSingle()

    if (staffErr || !staffRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!staffRow.is_super_admin && !staffRow.can_manage_area_monitors) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = (await req.json()) as { cityId?: string; note?: string }
    const cityId = body?.cityId
    const note = (body?.note ?? '').trim()

    if (!cityId) {
      return new Response(JSON.stringify({ error: 'cityId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: city, error: cErr } = await admin.from('cities').select('id, name').eq('id', cityId).maybeSingle()
    if (cErr || !city) {
      return new Response(JSON.stringify({ error: 'City not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: monitor, error: mErr } = await admin.from('city_monitors').select('*').eq('city_id', cityId).maybeSingle()
    if (mErr || !monitor?.email) {
      return new Response(JSON.stringify({ error: 'No monitor email for this city' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: refs } = await admin.from('reference_prices').select('product, reference_price')
    const refMap: Record<string, number> = {}
    for (const r of refs || []) {
      refMap[r.product] = Number(r.reference_price)
    }

    const { data: avgs } = await admin.from('city_product_averages').select('*').eq('city', city.name)

    const lines = overpricedLines(avgs || [], refMap)
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: 'No overpriced products for this city' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Number(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASSWORD')
    const smtpFrom = Deno.env.get('SMTP_FROM')
    const smtpSecure = Deno.env.get('SMTP_SECURE') === 'true'

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      return new Response(
        JSON.stringify({
          error: 'SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM on the function)'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpSecure,
        auth: {
          username: smtpUser,
          password: smtpPass
        }
      }
    })

    const subject = `[PriceWatch] High prices in ${city.name} — action requested`
    const plain = [
      `Dear ${monitor.head_name || 'Area head'},`,
      '',
      `Reported averages in ${city.name} are above the reference threshold (more than ${OVERPRICE_PCT}% over reference) for:`,
      '',
      ...lines.map((l) => `- ${l}`),
      '',
      note ? `Message from admin: ${note}` : '',
      '',
      'Please take appropriate action to monitor shops and pricing in your area.',
      '',
      '— PriceWatch Pakistan'
    ]
      .filter(Boolean)
      .join('\n')

    const htmlBody = `
      <p>Dear ${escapeHtml(monitor.head_name || 'Area head')},</p>
      <p>Reported average market prices in <strong>${escapeHtml(city.name)}</strong> are above the reference threshold (more than ${OVERPRICE_PCT}% over reference) for:</p>
      <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      ${note ? `<p><strong>Message from admin:</strong><br/>${escapeHtml(note)}</p>` : ''}
      <p>Please take appropriate action to monitor shops and pricing in your area.</p>
      <p style="color:#666;font-size:12px">Sent by PriceWatch Pakistan</p>
    `

    await client.send({
      from: smtpFrom,
      to: monitor.email,
      subject,
      content: plain,
      html: htmlBody
    })
    await client.close()

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('send-area-alert:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
