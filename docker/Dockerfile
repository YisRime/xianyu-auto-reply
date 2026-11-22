# 闲鱼自动回复系统 - 单容器全栈镜像
#
# 一个容器内运行：
#   - backend-web : HTTP API + 前端静态页面 + 定时任务调度
#   - websocket   : 各账号上游 IM 长连接、自动回复、自动发货
# 两者共用同一个 SQLite 数据文件，进程由 supervisord 托管。

FROM node:18-alpine AS frontend-builder
RUN npm config set registry https://registry.npmmirror.com
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PATCHRIGHT_BROWSERS_PATH=/ms-playwright
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV TZ=Asia/Shanghai

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null || true
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /app

# libatomic1：playwright/patchright 内置 node 需要；Debian 13 不再自动带入
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates supervisor \
        libatomic1 \
        fonts-dejavu-core fonts-liberation \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY common /app/common
COPY backend-web /app/backend-web
COPY websocket /app/websocket
COPY scheduler /app/scheduler
COPY --from=frontend-builder /build/dist /app/frontend/dist
COPY docker/supervisord.conf /etc/supervisor/conf.d/xianyu.conf

# 依赖取 backend-web / websocket / scheduler 三份 pyproject 的并集
RUN python - <<'PY'
import io, tomllib
deps = []
for proj in (
    "/app/backend-web/pyproject.toml",
    "/app/websocket/pyproject.toml",
    "/app/scheduler/pyproject.toml",
):
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

RUN python -m playwright install --with-deps --no-shell chromium \
    && python -m patchright install --no-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache/ms-playwright/.links /tmp/requirements.txt

RUN mkdir -p /app/data /app/backend-web/logs /app/backend-web/static/uploads \
             /app/websocket/logs /app/browser_data

EXPOSE 8089 8090

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
