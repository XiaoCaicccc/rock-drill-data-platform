# 凿岩机数据平台

## 本地开发

本项目本地开发基线为 **Node.js 20**（`>=20.19.0 <21`），与 CI 和 Docker 一致。开始前在 Windows 终端执行：

```powershell
node -v
npm -v
where.exe node
where.exe npm
```

若 PowerShell 拦截 `npm.ps1`，可使用 `npm.cmd`；但 `npm.cmd` 仍依赖有效的 `node.exe`。`where.exe node` 无结果时，应先安装或修复 Node 20 的 PATH，再继续验证。

1. 启动 PostgreSQL 与 MinIO：`docker compose up -d`
2. 复制 `.env.example` 为 `.env`，并填写本地变量。
3. 安装锁定依赖：`npm ci`
4. 执行本地静态验证：

   ```powershell
   npm run db:validate
   npm run db:generate
   npm run typecheck
   npm run lint
   npm run build
   ```

5. 仅在本地开发数据库同步结构：`npm run db:push`
6. 灌入演示数据：`npx tsx scripts/seed.ts`
7. 启动：`npm run dev`

本地验证无法执行时，可引用 CI 作为静态门禁证据，但不得记录为本机验证通过。

本地 MinIO API 地址为 `http://localhost:9000`，控制台为 `http://localhost:9001`。

## 数据库与安全约定

- 生产环境只运行 `npm run db:migrate`（`prisma migrate deploy`），禁止使用 HTTP `/api/setup`。
- 生产数据库禁止使用 `npm run db:push`；本地 `db:push` 仅用于开发环境。
- `/api/seed` 在生产默认禁用；只有配置了 `SEED_TOKEN` 且由管理员携带 `x-seed-token` 时才允许执行。
- 文档文件使用 S3 兼容对象存储；不允许向 `public/uploads` 写文件。
- 种子用户密码为 `R0ckDr!ll2024!`，仅用于开发环境，部署后必须修改。
