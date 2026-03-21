import { NextResponse } from 'next/server'
import { isStreamLive } from '@/lib/twitch'

export async function GET() {
  const live = await isStreamLive()
  return NextResponse.json({ live })
}