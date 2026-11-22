"""
WebSocket 服务 API 依赖。

单用户本地部署已取消所有鉴权：内部 HTTP API 不再校验服务间令牌。
"""
from __future__ import annotations


async def require_internal_auth() -> None:
    """兼容旧依赖签名：不再校验服务间令牌。"""
    return None
