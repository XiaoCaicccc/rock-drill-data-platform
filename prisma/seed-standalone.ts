import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs'

const db = new PrismaClient()

// Load the seed route source to reuse its logic
// Actually, we'll just re-implement a simpler approach:
// 1. Import the full seed route as text, eval it
// OR just make a fetch call to the running server

async function main() {
  const t0 = Date.now()
  
  // Step 1: Clear all tables (idempotent)
  console.log('Clearing all tables...')
  await db.inspectionDataItem.deleteMany()
  await db.inspectionRecord.deleteMany()
  await db.parameterItem.deleteMany()
  await db.parameterTemplate.deleteMany()
  await db.part.deleteMany()
  await db.meetingParticipant.deleteMany()
  await db.meeting.deleteMany()
  await db.document.deleteMany()
  await db.attendanceRecord.deleteMany()
  await db.task.deleteMany()
  await db.analysisReport.deleteMany()
  await db.equipment.deleteMany()
  await db.partCategory.deleteMany()
  console.log('All tables cleared')

  // Step 2: Start a minimal HTTP server that imports the route
  // Actually, let's just directly run the seed logic inline.
  // The full seed logic is in src/app/api/seed/route.ts
  // We need to extract and run it.

  // For now, let's use a workaround: start the Next.js server and call it
  const { spawn } = await import('child_process')
  const server = spawn('npx', ['next', 'dev', '--port', '3099'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Wait for server to be ready
  let ready = false
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000))
    try {
      const res = await fetch('http://127.0.0.1:3099/')
      if (res.ok || res.status === 200) {
        ready = true
        console.log('Server ready on port 3099')
        break
      }
    } catch {}
  }

  if (!ready) {
    server.kill()
    throw new Error('Server failed to start within 60s')
  }

  // Call seed API
  console.log('Calling seed API...')
  const seedRes = await fetch('http://127.0.0.1:3099/api/seed', { method: 'POST' })
  const seedData = await seedRes.json()
  console.log('Seed result:', JSON.stringify(seedData, null, 2))

  server.kill()
  await db.$disconnect()
  console.log(`Total time: ${((Date.now() - t0)/1000).toFixed(1)}s`)
}

main().catch(e => { console.error(e); process.exit(1) })
