"""
基于 MySQL 的键值存储与分布式锁。

功能：
1. 提供项目用到的 Redis 子集读写接口（get/set/nx/ex/delete/incr/expire/pipeline）
2. 提供跨进程分布式锁（DistributedLock / distributed_lock）
3. 提供发货幂等锁（try_acquire_delivery_lock / release_delivery_lock）

说明：
    项目数据量与并发量都很小，原先由 Redis 承担的缓存与互斥，
    改由同一套 MySQL 承担，避免额外运行一个 Redis 兼容进程。
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from loguru import logger
from sqlalchemy import text

from common.db.session import async_session_maker

KV_TABLE = "xy_kv_store"
LOCK_TABLE = "xy_distributed_locks"


def _now() -> int:
    """当前 Unix 时间戳（秒）。"""
    return int(time.time())


class Pipeline:
    """按顺序执行 get/set/delete 的简易管线，对齐 redis.pipeline() 用法。"""

    def __init__(self, store: "DbKvStore") -> None:
        self._store = store
        self._ops: list[tuple[str, tuple[Any, ...]]] = []

    def get(self, key: str) -> "Pipeline":
        self._ops.append(("get", (key,)))
        return self

    def set(self, key: str, value: Any, ex: int | None = None) -> "Pipeline":
        self._ops.append(("set", (key, value, ex)))
        return self

    def delete(self, key: str) -> "Pipeline":
        self._ops.append(("delete", (key,)))
        return self

    async def execute(self) -> list[Any]:
        """顺序执行已入队操作并返回结果列表。"""
        results: list[Any] = []
        for name, args in self._ops:
            handler = getattr(self._store, name)
            results.append(await handler(*args))
        self._ops.clear()
        return results


class DbKvStore:
    """MySQL 支持的键值存储，接口对齐项目实际用到的 Redis 子集。"""

    def pipeline(self) -> Pipeline:
        """返回一条可批量提交的管线。"""
        return Pipeline(self)

    @staticmethod
    def _encode(value: Any) -> str:
        if isinstance(value, bytes):
            return value.decode("utf-8", "replace")
        return "" if value is None else str(value)

    async def get(self, key: str) -> str | None:
        """读取键值，已过期视为不存在并顺手清理。"""
        async with async_session_maker() as session:
            row = (
                await session.execute(
                    text(f"SELECT v, expires_at FROM {KV_TABLE} WHERE k = :k"),
                    {"k": key},
                )
            ).first()
            if row is None:
                return None
            value, expires_at = row[0], row[1]
            if expires_at is not None and int(expires_at) <= _now():
                await session.execute(
                    text(f"DELETE FROM {KV_TABLE} WHERE k = :k"), {"k": key}
                )
                await session.commit()
                return None
            return value

    async def set(
        self,
        key: str,
        value: Any,
        ex: int | None = None,
        nx: bool = False,
    ) -> bool:
        """写入键值；nx=True 时仅在键不存在（或已过期）时写入。"""
        now = _now()
        expires_at = now + int(ex) if ex else None
        payload = {"k": key, "v": self._encode(value), "exp": expires_at}

        if nx:
            async with async_session_maker() as session:
                row = (
                    await session.execute(
                        text(f"SELECT expires_at FROM {KV_TABLE} WHERE k = :k"),
                        {"k": key},
                    )
                ).first()
            if row is not None:
                existing_expires = row[0]
                if existing_expires is None or int(existing_expires) > now:
                    return False

        sql = (
            f"INSERT INTO {KV_TABLE}(k, v, expires_at) VALUES(:k, :v, :exp) "
            "ON DUPLICATE KEY UPDATE v = :v, expires_at = :exp"
        )
        async with async_session_maker() as session:
            await session.execute(text(sql), payload)
            await session.commit()
        return True

    async def setex(self, key: str, seconds: int, value: Any) -> bool:
        """带过期时间写入。"""
        return await self.set(key, value, ex=seconds)

    async def delete(self, *keys: str) -> int:
        """删除一个或多个键，返回删除数量。"""
        if not keys:
            return 0
        params = {f"k{i}": k for i, k in enumerate(keys)}
        placeholders = ", ".join(f":k{i}" for i in range(len(keys)))
        async with async_session_maker() as session:
            result = await session.execute(
                text(f"DELETE FROM {KV_TABLE} WHERE k IN ({placeholders})"), params
            )
            await session.commit()
            return result.rowcount or 0

    async def exists(self, key: str) -> int:
        """键是否存在（1/0）。"""
        return 1 if await self.get(key) is not None else 0

    async def incr(self, key: str) -> int:
        """自增并返回新值，键不存在时按 0 起算。"""
        async with async_session_maker() as session:
            await session.execute(
                text(
                    f"INSERT INTO {KV_TABLE}(k, v, expires_at) VALUES(:k, '1', NULL) "
                    "ON DUPLICATE KEY UPDATE v = CAST(COALESCE(v, '0') AS SIGNED) + 1"
                ),
                {"k": key},
            )
            row = (
                await session.execute(
                    text(f"SELECT v FROM {KV_TABLE} WHERE k = :k"), {"k": key}
                )
            ).first()
            await session.commit()
        return int(row[0]) if row and row[0] is not None else 1

    async def expire(self, key: str, seconds: int) -> bool:
        """设置键的过期时间。"""
        async with async_session_maker() as session:
            result = await session.execute(
                text(f"UPDATE {KV_TABLE} SET expires_at = :exp WHERE k = :k"),
                {"k": key, "exp": _now() + int(seconds)},
            )
            await session.commit()
            return bool(result.rowcount)


_kv_store: DbKvStore | None = None


async def get_kv_store() -> DbKvStore:
    """取全局键值存储实例。"""
    global _kv_store
    if _kv_store is None:
        _kv_store = DbKvStore()
    return _kv_store


async def close_kv_store() -> None:
    """兼容原有关闭钩子，无外部连接需要释放。"""
    return None


DEFAULT_EXPIRE = 60


class DistributedLock:
    """基于 MySQL 唯一键的跨进程分布式锁。"""

    def __init__(self, lock_name: str, expire: int = DEFAULT_EXPIRE) -> None:
        self.lock_name = lock_name
        self.expire = expire
        self.token = uuid.uuid4().hex
        self.acquired = False

    async def acquire(self, blocking: bool = True, timeout: float = 10.0) -> bool:
        """获取锁，blocking=True 时在 timeout 内重试。"""
        deadline = time.monotonic() + max(0.0, timeout)
        while True:
            if await self._try_acquire():
                self.acquired = True
                return True
            if not blocking or time.monotonic() >= deadline:
                return False
            await _sleep(0.05)

    async def _try_acquire(self) -> bool:
        now = _now()
        expires_at = now + int(self.expire)
        try:
            async with async_session_maker() as session:
                await session.execute(
                    text(
                        f"INSERT INTO {LOCK_TABLE}(lock_name, owner, expires_at) "
                        "VALUES(:name, :owner, :exp) "
                        "ON DUPLICATE KEY UPDATE "
                        "owner = IF(expires_at <= :now, VALUES(owner), owner), "
                        "expires_at = IF(expires_at <= :now, VALUES(expires_at), expires_at)"
                    ),
                    {"name": self.lock_name, "owner": self.token, "exp": expires_at, "now": now},
                )
                row = (
                    await session.execute(
                        text(f"SELECT owner FROM {LOCK_TABLE} WHERE lock_name = :name"),
                        {"name": self.lock_name},
                    )
                ).first()
                await session.commit()
            return bool(row) and row[0] == self.token
        except Exception as exc:  # noqa: BLE001 - 锁不可用时由调用方降级
            logger.warning(f"获取分布式锁失败[{self.lock_name}]: {type(exc).__name__}: {exc}")
            return False

    async def release(self) -> bool:
        """释放锁，仅持有者可释放。"""
        if not self.acquired:
            return False
        try:
            async with async_session_maker() as session:
                await session.execute(
                    text(
                        f"DELETE FROM {LOCK_TABLE} WHERE lock_name = :name AND owner = :owner"
                    ),
                    {"name": self.lock_name, "owner": self.token},
                )
                await session.commit()
            self.acquired = False
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"释放分布式锁失败[{self.lock_name}]: {type(exc).__name__}: {exc}")
            return False

    async def extend(self, additional_time: int | None = None) -> bool:
        """续期锁，返回是否仍由自己持有。"""
        seconds = int(additional_time or self.expire)
        try:
            async with async_session_maker() as session:
                result = await session.execute(
                    text(
                        f"UPDATE {LOCK_TABLE} SET expires_at = :exp "
                        "WHERE lock_name = :name AND owner = :owner"
                    ),
                    {"name": self.lock_name, "owner": self.token, "exp": _now() + seconds},
                )
                await session.commit()
                return bool(result.rowcount)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"续期分布式锁失败[{self.lock_name}]: {type(exc).__name__}: {exc}")
            return False

    @property
    def is_locked(self) -> bool:
        """当前实例是否持有锁。"""
        return self.acquired


async def _sleep(seconds: float) -> None:
    import asyncio

    await asyncio.sleep(seconds)


@asynccontextmanager
async def distributed_lock(
    lock_name: str,
    expire: int = 60,
    blocking: bool = True,
    timeout: float = 10.0,
) -> AsyncIterator[Optional[DistributedLock]]:
    """分布式锁上下文管理器，获取失败时 yield None。"""
    lock = DistributedLock(lock_name, expire=expire)
    if await lock.acquire(blocking=blocking, timeout=timeout):
        try:
            yield lock
        finally:
            await lock.release()
    else:
        yield None


class LockResult:
    """发货锁获取结果。"""

    def __init__(
        self,
        lock: Optional[DistributedLock] = None,
        is_locked_by_other: bool = False,
        has_error: bool = False,
    ) -> None:
        self.lock = lock
        self.is_locked_by_other = is_locked_by_other
        self.has_error = has_error

    @property
    def success(self) -> bool:
        """是否成功持有锁。"""
        return self.lock is not None


async def try_acquire_delivery_lock(
    order_no: str,
    expire: int = 120,
    holder_info: str = "",
    wait_timeout: float = 5.0,
) -> LockResult:
    """获取发货幂等锁，防止同一订单被并发重复发货。"""
    lock_name = f"delivery:order:{order_no}"
    lock = DistributedLock(lock_name, expire=expire)
    try:
        acquired = await lock.acquire(blocking=True, timeout=wait_timeout)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"发货锁异常[{order_no}]: {type(exc).__name__}: {exc}")
        return LockResult(has_error=True)
    if acquired:
        logger.debug(f"已获取发货锁[{order_no}] holder={holder_info}")
        return LockResult(lock=lock)
    return LockResult(is_locked_by_other=True)


async def release_delivery_lock(lock_result: LockResult | None) -> bool:
    """释放发货锁。"""
    if not lock_result or not lock_result.lock:
        return False
    return await lock_result.lock.release()
