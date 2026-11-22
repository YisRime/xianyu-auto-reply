# Backend-Web 服务 Dockerfile
# 单进程同时提供：HTTP API + 前端静态页面 + 定时任务调度（scheduler 已并入）
#
# 说明：
#   1. 第一阶段用 node 构建 frontend/dist，产物交给后端托管，镜像内不再需要 nginx；
#   2. 依赖取 backend-web 与 scheduler 两份 pyproject 的并集（后者提��� apscheduler）；
#   3. 不再 COPY launcher（该模块已删除）。

FROM node:18-alpine AS frontend-builder
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV TZ=Asia/Shanghai

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
        libatomic1 \
        fonts-dejavu-core fonts-liberation \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY common /app/common
COPY backend-web /app/backend-web
# backend-web 运行时会 import scheduler/sched 包（定时任务已并入）
COPY scheduler /app/scheduler
COPY --from=frontend-builder /build/dist /app/frontend/dist

RUN python - <<'PY'
import io, tomllib
deps = []
for proj in ("/app/backend-web/pyproject.toml", "/app/scheduler/pyproject.toml"):
    with open(proj, "rb") as fh:
        deps.extend(tomllib.load(fh).get("project", {}).get("dependencies", []))
seen, uniq = set(), []
for dep in deps:
    name = dep.split(";")[0].strip()
    key = name.split("=")[0].split(">")[0].split("<")[0].split("[")[0].strip().lower()
    if key in seen:
        continue
    seen.add(key)
    uniq.append(name)
io.open("/tmp/requirements.txt", "w", encoding="utf-8").write("\n".join(uniq))
PY

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev \
    && pip install --no-cache-dir -r /tmp/requirements.txt \
    && apt-get purge -y --auto-remove gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/* /root/.cache

RUN python -m playwright install --with-deps chromium \
    && python -m patchright install chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache/ms-playwright/.links

RUN mkdir -p /app/backend-web/logs /app/backend-web/static/uploads /app/data

EXPOSE 8089

CMD ["python", "backend-web/main.py"]
