# WebSocket 服务 Dockerfile
# 负责每个账号的上游 IM 长连接、自动回复与自动发货
#
# 说明：不再 COPY launcher（该模块已删除）。

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
        fonts-dejavu-core fonts-liberation \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY common /app/common
COPY websocket /app/websocket

RUN python -c "\
import tomllib; \
deps = tomllib.load(open('/app/websocket/pyproject.toml','rb')).get('project',{}).get('dependencies',[]); \
open('/tmp/requirements.txt','w').write('\n'.join(deps))"

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev \
    && pip install --no-cache-dir -r /tmp/requirements.txt \
    && apt-get purge -y --auto-remove gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/* /root/.cache

RUN python -m playwright install --with-deps chromium \
    && python -m patchright install chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache/ms-playwright/.links

RUN mkdir -p /app/websocket/logs

EXPOSE 8090

CMD ["python", "websocket/main.py"]
