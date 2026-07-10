# 凿岩机数据平台

## 本地开发

1. 启动 PostgreSQL 与 MinIO：`docker compose up -d`
2. 复制 `.env.example` 为 `.env`，并填写本地变量。
3. 安装依赖：`npm ci`
4. 生成客户端与同步开发数据库：`npm run db:generate`、`npm run db:push`
5. 灌入演示数据：`npx tsx scripts/seed.ts`
6. 启动：`npm run dev`

本地 MinIO API 地址为 `http://localhost:9000`，控制台为 `http://localhost:9001`。

## 数据库与安全约定

- 生产环境只运行 `npm run db:migrate`（`prisma migrate deploy`），禁止使用 HTTP `/api/setup`。
- `/api/seed` 在生产默认禁用；只有配置了 `SEED_TOKEN` 且由管理员携带 `x-seed-token` 时才允许执行。
- 文档文件使用 S3 兼容对象存储；不允许向 `public/uploads` 写文件。
- 种子用户密码为 `R0ckDr!ll2024!`，仅用于开发环境，部署后必须修改。
