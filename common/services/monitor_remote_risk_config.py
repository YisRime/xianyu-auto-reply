"""
商品监控 - 远程过风控配置（全局系统设置）

功能：
1. 统一管理「远程过风控」配置在系统设置表（xy_system_settings）中的存储键
2. 提供读取 / 保存配置的方法，供 backend-web 接口与 scheduler 定时任务共用
3. 提供远程服务URL的合法性校验，保存与调用前统一口径

说明：
- 单用户本地部署，配置为全局唯一，原 user_id 参数保留用于兼容调用方。
- 采集触发风控（FAIL_SYS_USER_VALIDATE / RGV587 / punish 等）时，若配置了
  远程服务URL与秘钥，则调用远程服务求解验证链接，拿到 x5sec 后用同账号重试采集。
"""
from __future__ import annotations

from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models.system_setting import SystemSetting

# 系统设置存储键：远程过风控服务地址 / 调用秘钥
MONITOR_REMOTE_RISK_URL_KEY = "monitor.remote_risk_url"
MONITOR_REMOTE_RISK_SECRET_KEY = "monitor.remote_risk_secret"

# 存储键对应的中文描述
_KEY_DESCRIPTIONS = {
    MONITOR_REMOTE_RISK_URL_KEY: "商品监控-远程过风控服务URL",
    MONITOR_REMOTE_RISK_SECRET_KEY: "商品监控-远程过风控秘钥",
}

# URL 最大长度
MAX_URL_LENGTH = 500
# 秘钥最大长度
MAX_SECRET_LENGTH = 200


def validate_remote_risk_url(url: str) -> Optional[str]:
    """校验远程过风控服务URL是否合法。"""
    normalized = (url or "").strip()
    if not normalized:
        return None
    if not normalized.lower().startswith(("http://", "https://")):
        return "远程服务URL 必须以 http:// 或 https:// 开头"
    if len(normalized) > MAX_URL_LENGTH:
        return f"远程服务URL 长度不能超过 {MAX_URL_LENGTH} 个字符"
    return None


def validate_remote_risk_secret(secret: str) -> Optional[str]:
    """校验远程过风控秘钥是否合法。"""
    if len((secret or "").strip()) > MAX_SECRET_LENGTH:
        return f"秘钥长度不能超过 {MAX_SECRET_LENGTH} 个字符"
    return None


async def get_remote_risk_config(session: AsyncSession, user_id: Optional[int] = None) -> Dict[str, str]:
    """读取远程过风控配置；user_id 参数保留仅为兼容旧调用方。"""
    del user_id
    stmt = select(SystemSetting.key, SystemSetting.value).where(
        SystemSetting.key.in_([MONITOR_REMOTE_RISK_URL_KEY, MONITOR_REMOTE_RISK_SECRET_KEY])
    )
    result = await session.execute(stmt)
    values = {row[0]: (row[1] or "").strip() for row in result.all()}
    return {
        "url": values.get(MONITOR_REMOTE_RISK_URL_KEY, ""),
        "secret": values.get(MONITOR_REMOTE_RISK_SECRET_KEY, ""),
    }


def is_remote_risk_enabled(config: Optional[Dict[str, str]]) -> bool:
    """远程过风控是否可用：URL 与秘钥都填写了才视为启用。"""
    if not config:
        return False
    return bool((config.get("url") or "").strip() and (config.get("secret") or "").strip())


async def save_remote_risk_config(
    session: AsyncSession,
    user_id: int,
    url: str,
    secret: str,
) -> Dict[str, str]:
    """保存远程过风控配置；user_id 参数保留仅为兼容旧调用方。"""
    del user_id
    payload = {
        MONITOR_REMOTE_RISK_URL_KEY: (url or "").strip(),
        MONITOR_REMOTE_RISK_SECRET_KEY: (secret or "").strip(),
    }

    stmt = select(SystemSetting).where(SystemSetting.key.in_(list(payload.keys())))
    result = await session.execute(stmt)
    existing = {setting.key: setting for setting in result.scalars().all()}

    for key, value in payload.items():
        setting = existing.get(key)
        if setting:
            setting.value = value
            setting.description = _KEY_DESCRIPTIONS[key]
        else:
            session.add(SystemSetting(key=key, value=value, description=_KEY_DESCRIPTIONS[key]))

    await session.commit()
    return {
        "url": payload[MONITOR_REMOTE_RISK_URL_KEY],
        "secret": payload[MONITOR_REMOTE_RISK_SECRET_KEY],
    }


__all__ = [
    "MONITOR_REMOTE_RISK_URL_KEY",
    "MONITOR_REMOTE_RISK_SECRET_KEY",
    "MAX_URL_LENGTH",
    "MAX_SECRET_LENGTH",
    "validate_remote_risk_url",
    "validate_remote_risk_secret",
    "get_remote_risk_config",
    "is_remote_risk_enabled",
    "save_remote_risk_config",
]
