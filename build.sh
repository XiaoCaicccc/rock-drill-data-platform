#!/bin/sh
export LIBSQL_CLIENT_BACKEND=wasm
npx prisma generate
export LIBSQL_CLIENT_BACKEND=wasm
npx next build