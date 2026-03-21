const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL_NAME!
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!

let cachedToken: { token: string; expires_at: number } | null = null

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.token
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  })

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }

  return cachedToken.token
}

export async function isStreamLive(): Promise<boolean> {
  try {
    const token = await getAppAccessToken()
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: 0 },
      }
    )
    const data = await res.json()
    return Array.isArray(data.data) && data.data.length > 0
  } catch (err) {
    console.error('Twitch stream check failed:', err)
    return false
  }
}