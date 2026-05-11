import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
    const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
    const SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID

    if (!ACCOUNT_SID || !AUTH_TOKEN || !SERVICE_SID) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Twilio credentials missing' })
      }
    }

    const { action, phone, code } = JSON.parse(event.body || '{}')
    const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')

    if (action === 'send') {
      const params = new URLSearchParams()
      params.append('To', phone)
      params.append('Channel', 'sms')

      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${SERVICE_SID}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      )
      const data = await res.json()
      console.log('Send response:', JSON.stringify(data))
      return { statusCode: 200, headers, body: JSON.stringify(data) }
    }

    if (action === 'verify') {
      const params = new URLSearchParams()
      params.append('To', phone)
      params.append('Code', code)

      console.log('=== VERIFY REQUEST ===')
      console.log('Phone:', phone)
      console.log('Code:', code)
      console.log('Service SID:', SERVICE_SID)
      console.log('Params:', params.toString())

      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${SERVICE_SID}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      )
      const data = await res.json()
      console.log('=== TWILIO RAW RESPONSE ===')
      console.log('HTTP status:', res.status)
      console.log('Body:', JSON.stringify(data))
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...data,
          _debug: {
            sentPhone: phone,
            sentCode: code,
            twilioHttpStatus: res.status
          }
        })
      }
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    console.error('SMS function error:', message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: message })
    }
  }
}
