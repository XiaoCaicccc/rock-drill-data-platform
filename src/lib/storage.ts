import { Client } from 'minio'

const endpoint = process.env.STORAGE_ENDPOINT
const accessKey = process.env.STORAGE_ACCESS_KEY
const secretKey = process.env.STORAGE_SECRET_KEY
const bucket = process.env.STORAGE_BUCKET ?? 'rock-drill-documents'

function getClient() {
  if (!endpoint || !accessKey || !secretKey) throw new Error('对象存储未配置')
  const url = new URL(endpoint.includes('://') ? endpoint : `http://${endpoint}`)
  return new Client({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
    useSSL: url.protocol === 'https:',
    accessKey,
    secretKey,
  })
}

async function ensureBucket(client: Client) {
  if (!(await client.bucketExists(bucket))) await client.makeBucket(bucket, 'us-east-1')
}

export function documentStorageKey(userId: string, fileName: string) {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_')
  return `documents/${userId}/${crypto.randomUUID()}-${safeName}`
}

export async function createUploadUrl(key: string, expires = 15 * 60) {
  const client = getClient()
  await ensureBucket(client)
  return client.presignedPutObject(bucket, key, expires)
}

export async function createDownloadUrl(key: string, expires = 5 * 60) {
  const client = getClient()
  return client.presignedGetObject(bucket, key, expires)
}

export async function deleteStoredObject(key: string) {
  const client = getClient()
  await client.removeObject(bucket, key)
}
