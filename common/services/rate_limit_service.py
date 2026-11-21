"""
滑动窗口限流（基于 MySQL 键值存储实现）。

功能：
1. 按业务命名空间与标识统计窗口内的请求次数
2. 超限时返回建议重试等待秒数

说明：
    项目已移除 Redis，限流计数改存于 xy_kv_store 的 JSON 时间戳列表。
    并发场景下按最后写入者为准，对单机自用部署足够。
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass

from common.db.kv_store import get_kv_store


@dataclass(frozen=True)
class RateLimitResult:
    """记录本次请求是否放行、剩余额度和建议等待秒数。"""

    allowed: bool
    remaining: int
    retry_after: int


async def check_sliding_window_limit(
    namespace: str, identifier: str, *, window_seconds: int, max_requests: int,
) -> RateLimitResult:
    """按业务命名空间和标识限流。

    Args:
        namespace: 限流键业务前缀。
        identifier: IP、账号等限流标识，写入存储前统一哈希。
        window_seconds: 滑动窗口秒数。
        max_requests: 同一窗口允许的最大请求数。
    Returns:
        放行结果、剩余额度和拒绝时的重试等待秒数。
    """
    if window_seconds <= 0 or max_requests <= 0:
        raise ValueError("限流窗口和请求上限必须大于零")

    identity_hash = hashlib.sha256(identifier.encode("utf-8")).hexdigest()
    key = f"rate:{namespace}:{identity_hash}"
    store = await get_kv_store()

    now_ms = int(time.time() * 1000)
    window_ms = window_seconds * 1000
    request_id = uuid.uuid4().hex

    raw = await store.get(key)
    try:
        stamps = [int(item) for item in json.loads(raw)] if raw else []
    except (TypeError, ValueError):
        stamps = []
    stamps = [item for item in stamps if item > now_ms - window_ms]

    if len(stamps) >= max_requests:
        oldest = min(stamps) if stamps else now_ms
        retry_after = max(1, (oldest + window_ms - now_ms + 999) // 1000)
        await store.set(key, json.dumps(stamps), ex=window_seconds)
        return RateLimitResult(allowed=False, remaining=0, retry_after=retry_after)

    stamps.append(now_ms)
    await store.set(key, json.dumps(stamps), ex=window_seconds)
    return RateLimitResult(
        allowed=True, remaining=max_requests - len(stamps), retry_after=0
    )
