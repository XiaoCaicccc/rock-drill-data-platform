import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST() {
  try {
    const output = execSync('npx prisma db push --accept-data-loss 2>&1', {
      timeout: 60000,
      env: { ...process.env },
    }).toString()
    return NextResponse.json({ success: true, output })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Setup failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}