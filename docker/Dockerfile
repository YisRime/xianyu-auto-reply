# 闲鱼自动回复系统 - 单容器全栈镜像
#
# 一个容器内运行：
#   - backend-web : HTTP API + 前端静态页面 + 定时任务调度
#   - websocket   : 各账号上游 IM 长连接、自动回复、自动发货
# 两个进程共用同一个 SQLite 数据文件与同一份 Chromium，由 supervisord 托管。

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

COPY requirements.txt /app/requirements.txt

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev \
    && pip install --no-cache-dir -r /app/requirements.txt \
    && apt-get purge -y --auto-remove gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/* /root/.cache /app/requirements.txt

# 只安装一份 Chrome（chromium + headless shell）：patchright 的安装 + 系统依赖，
# playwright 期望的 revision 目录由下面的软链指向同一份文件
RUN python -m patchright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# 让 playwright 的期望版本目录指向 patchright 安装的那份 Chromium（同一文件，零额外空间）
RUN python - <<'PY'
import json
import os
import pathlib

import patchright
import playwright


def revisions(module) -> dict:
    manifest = pathlib.Path(module.__file__).parent / "driver" / "package" / "browsers.json"
    out = {}
    for item in json.loads(manifest.read_text(encoding="utf-8"))["browsers"]:
        out[item["name"]] = str(item["revision"])
    return out


root = pathlib.Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"])
pw = revisions(playwright)
pr = revisions(patchright)

# chromium 与 chromium-headless-shell 都要复用；
# headless 启动时 playwright 会直接找 headless shell，缺了会报 Executable doesn't exist。
for name in ("chromium", "chromium-headless-shell"):
    # 目录名把浏览器名里的 - 换成 _，例如 chromium_headless_shell-1255
    folder = name.replace("-", "_")
    pr_rev = pr.get(name)
    pw_rev = pw.get(name)
    if not pr_rev or not pw_rev:
        print(f"skip {name}: revision missing")
        continue
    source = root / f"{folder}-{pr_rev}"
    target = root / f"{folder}-{pw_rev}"
    if not source.is_dir():
        raise SystemExit(f"patchright {name} missing: {source}")
    if pr_rev == pw_rev:
        print(f"{name}: same revision {pr_rev}, nothing to link")
    elif target.exists() or target.is_symlink():
        print(f"{name}: {target.name} already present, nothing to link")
    else:
        target.symlink_to(source, target_is_directory=True)
        print(f"linked {target.name} -> {source.name}")
PY

COPY common /app/common
COPY backend-web /app/backend-web
COPY websocket /app/websocket
COPY scheduler /app/scheduler
COPY --from=frontend-builder /build/dist /app/frontend/dist
COPY docker/supervisord.conf /etc/supervisor/conf.d/xianyu.conf

RUN mkdir -p /app/data /app/backend-web/logs /app/backend-web/static/uploads \
             /app/websocket/logs /app/browser_data \
    && find /app -name '__pycache__' -type d -prune -exec rm -rf {} + \
    && find /app -name '*.pyc' -delete

EXPOSE 8089 8090

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
