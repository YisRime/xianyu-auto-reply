"""认证限流：对注册、验证码发送和登录失败计数，底层为 MySQL 键值存储。"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass

from common.db.kv_store import get_kv_store
from common.services.rate_limit_service import check_sliding_window_limit

# 登录失败统计窗口与维度上限（IP 20 次 / 身份 10 次，窗口 10 分钟）
LOGIN_WINDOW_SECONDS = 600
LOGIN_IP_LIMIT = 20
LOGIN_IDENTITY_LIMIT = 10


class AuthRateLimitRejected(ValueError):
    """认证频率超过限制，统一返回业务码 42901。"""

    code = 42901


@dataclass(frozen=True)
class LoginAttempt:
    """一次登录占位的哈希键与唯一标识，键中不存储原始身份。"""

    keys: tuple[str, ...]
    request_id: str


def _identity_key(namespace: str, identity: str) -> str:
    """构造认证计数键；参数为命名空间和身份，返回 SHA256 哈希后的键。"""
    digest = hashlib.sha256(identity.strip().casefold().encode("utf-8")).hexdigest()
    return f"rate:auth:{namespace}:{digest}"


async def _load_entries(key: str) -> list[dict]:
    """读取某个计数键在窗口内的占位与失败记录。"""
    store = await get_kv_store()
    raw = await store.get(key)
    try:
        entries = json.loads(raw) if raw else []
    except (TypeError, ValueError):
        entries = []
    deadline = int(time.time() * 1000) - LOGIN_WINDOW_SECONDS * 1000
    return [item for item in entries if int(item.get("ts", 0)) > deadline]


async def _save_entries(key: str, entries: list[dict]) -> None:
    """写回计数键并续期。"""
    store = await get_kv_store()
    await store.set(key, json.dumps(entries), ex=LOGIN_WINDOW_SECONDS)


async def begin_login_attempt(ip: str | None, account: str, email: str | None = None) -> LoginAttempt:
    """检查并占用 IP/账号/绑定邮箱额度；超限抛出业务错误。"""
    keys = [_identity_key('login:ip', ip or 'unknown'), _identity_key('login:identity', account)]
    if email:
        keys.append(_identity_key('login:identity', email))
    attempt = LoginAttempt(tuple(dict.fromkeys(keys)), uuid.uuid4().hex)
    now_ms = int(time.time() * 1000)

    for index, key in enumerate(attempt.keys):
        entries = await _load_entries(key)
        if any(item.get("id") == attempt.request_id for item in entries):
            return attempt
        limit = LOGIN_IP_LIMIT if index == 0 else LOGIN_IDENTITY_LIMIT
        if len(entries) >= limit:
            dimension = "当前 IP" if index == 0 else "该账号或邮箱"
            raise AuthRateLimitRejected(f"{dimension}登录失败次数过多，请10分钟后再试")

    for key in attempt.keys:
        entries = await _load_entries(key)
        entries.append({"id": attempt.request_id, "ts": now_ms, "kind": "p"})
        await _save_entries(key, entries)
    return attempt


async def finish_login_attempt(attempt: LoginAttempt, *, success: bool) -> None:
    """结束本次登录占位；成功清除失败计数，失败仅保留占位为失败记录。"""
    now_ms = int(time.time() * 1000)
    for key in attempt.keys:
        entries = await _load_entries(key)
        entries = [item for item in entries if item.get("id") != attempt.request_id]
        if success:
            entries = [item for item in entries if item.get("kind") != "f"]
        else:
            entries.append({"id": attempt.request_id, "ts": now_ms, "kind": "f"})
        await _save_entries(key, entries)


async def check_registration_limit(ip: str | None, email: str) -> None:
    """注册提交每次尝试都计数：同 IP 10 分钟 5 次、同邮箱 24 小时 1 次。"""
    ip_result = await check_sliding_window_limit(
        'auth:register:ip', ip or 'unknown', window_seconds=600, max_requests=5,
    )
    email_result = await check_sliding_window_limit(
        'auth:register:email', email.strip().casefold(), window_seconds=86400, max_requests=1,
    )
    if not ip_result.allowed:
        raise AuthRateLimitRejected("当前 IP 注册次数过多，请10分钟后再试")
    if not email_result.allowed:
        raise AuthRateLimitRejected("该邮箱24小时内已尝试注册，请稍后再试")


async def check_email_code_limit(ip: str | None, email: str, purpose: str) -> None:
    """验证码发送（含拒绝）按用途限制 IP 10 分钟 5 次、邮箱每分钟 1 次。"""
    ip_result = await check_sliding_window_limit(
        f'auth:code:{purpose}:ip', ip or 'unknown', window_seconds=600, max_requests=5,
    )
    email_result = await check_sliding_window_limit(
        f'auth:code:{purpose}:email', email.strip().casefold(), window_seconds=60, max_requests=1,
    )
    if not ip_result.allowed or not email_result.allowed:
        raise AuthRateLimitRejected("验证码发送过于频繁，请稍后再试")
