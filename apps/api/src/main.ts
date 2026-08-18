import 'dotenv/config'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { initState, registerRoutes } from './routes.js'
import { getState } from './store.js'

const app = Fastify({ logger: true })

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:5199'
await app.register(cors, { origin: WEB_ORIGIN.split(',').map((s) => s.trim()) })

await initState()
await registerRoutes(app)

/** 健康检查（render.yaml healthCheckPath） */
app.get('/healthz', async () => ({ ok: true, svc: 'shitu-api', ts: new Date().toISOString() }))

/** 就绪检查：状态仓储已载入（Turso 已连通并完成建表） */
app.get('/readyz', async () => ({ ok: !!getState() }))

const port = Number(process.env.PORT ?? 8787)

/* 单服务部署（render.yaml）：API 同源托管前端静态文件（apps/web/dist）。
   /api/* 未命中返回 JSON 404；其余路径 SPA fallback 到 index.html。 */
const here = dirname(fileURLToPath(import.meta.url))
const webDist = join(here, '../../web/dist')
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist })
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api') || req.raw.url?.startsWith('/healthz') || req.raw.url?.startsWith('/readyz')) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: req.raw.url })
    }
    return reply.sendFile('index.html')
  })
}

await app.listen({ port, host: '0.0.0.0' })
