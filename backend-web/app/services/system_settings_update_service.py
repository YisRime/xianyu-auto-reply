"""
系统设置保存前的统一校验与规范化服务。

功能：
1. 对单项和批量系统设置执行相同校验
2. 基于批量提交后的完整目标状态校验跨字段约束
3. 规范化枚举、数字、邮箱和远程接口配置
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.system_setting_service import SENSITIVE_KEYS, SystemSettingService
from common.services.system_setting_validation import (
    parse_boolean_setting,
    parse_log_retention_days,
    validate_business_setting,
)
from common.services.email_domain_policy import EMAIL_DOMAIN_DEFAULTS, normalize_policy_setting
from common.utils.email_utils import normalize_email_address

LOG_RETENTION_KEY = "log.retention_days"
CAPTCHA_SLIDER_MODE_KEY = "captcha.slider_mode"
CAPTCHA_SLIDER_MODES = {"browser", "real_mouse"}
PROXY_URL_KEY = "proxy.api_url"
PROXY_ENABLED_KEY = "proxy.enabled"

_TRIMMED_SETTING_KEYS = {
    "smtp_port",
    "smtp_user",
    LOG_RETENTION_KEY,
    PROXY_URL_KEY,
}


@dataclass(frozen=True, slots=True)
class ValidatedSystemSettings:
    """校验成功后的设置值及需要实时刷新的日志保留天数。"""

    values: dict[str, str]
    retention_days: int | None = None


def _normalize_email_setting(key: str, value: str) -> tuple[str, str | None]:
    """规范化允许留空的邮箱设置。"""
    if key not in {"smtp_user", "withdraw.notify_email"} or not value:
        return value, None
    normalized, error_message = normalize_email_address(value)
    if error_message:
        field_name = "发件邮箱" if key == "smtp_user" else "提现通知邮箱"
        return value, f"{field_name}格式不正确"
    return normalized or "", None


def _normalize_setting_value(key: str, raw_value: str) -> tuple[str, str | None]:
    """规范化并校验单个设置值，不处理需要完整目标状态的跨字段约束。"""
    value = str(raw_value or "")
    if key in EMAIL_DOMAIN_DEFAULTS:
        try:
            return normalize_policy_setting(key, value), None
        except ValueError as exc:
            return value, str(exc)
    if key in _TRIMMED_SETTING_KEYS:
        value = value.strip()

    if key == CAPTCHA_SLIDER_MODE_KEY:
        value = value.strip().lower()
        if value not in CAPTCHA_SLIDER_MODES:
            return value, "滑块滑动方式无效，请选择浏览器自动滑动或真实鼠标滑动"

    if key == LOG_RETENTION_KEY:
        _, error_message = parse_log_retention_days(value)
        if error_message:
            return value, error_message

    value, email_error = _normalize_email_setting(key, value)
    if email_error:
        return value, email_error

    business_error = validate_business_setting(key, value)
    return value, business_error


def _validate_target_state(target: Mapping[str, str], changed_keys: set[str]) -> str | None:
    """基于本次提交后的完整目标状态校验跨字段约束。"""
    if changed_keys.intersection({PROXY_URL_KEY, PROXY_ENABLED_KEY}):
        proxy_url = str(target.get(PROXY_URL_KEY) or "").strip()
        if parse_boolean_setting(target.get(PROXY_ENABLED_KEY)) and not proxy_url:
            return "开启代理前请先填写代理 API 的 URL"


async def validate_system_settings_update(
    updates: Mapping[str, str],
    service: SystemSettingService,
) -> tuple[ValidatedSystemSettings | None, str | None]:
    """
    校验并规范化一组系统设置。

    Args:
        updates: 本次需要保存的设置键值。
        service: 系统设置服务，用于读取当前状态完成跨字段校验。
    Returns:
        (校验结果, 错误信息)，校验失败时结果为 None。
    """
    if not updates:
        return None, "没有需要保存的系统设置"

    sensitive_keys = set(updates).intersection(SENSITIVE_KEYS)
    if sensitive_keys:
        return None, "该设置需要使用专用接口修改"

    normalized: dict[str, str] = {}
    for key, raw_value in updates.items():
        value, error_message = _normalize_setting_value(key, raw_value)
        if error_message:
            return None, error_message
        normalized[key] = value

    current_settings = await service.list_settings()
    target_settings = {**current_settings, **normalized}
    target_error = _validate_target_state(target_settings, set(normalized))
    if target_error:
        return None, target_error
    retention_days = None
    if LOG_RETENTION_KEY in normalized:
        retention_days, _ = parse_log_retention_days(normalized[LOG_RETENTION_KEY])
    return ValidatedSystemSettings(normalized, retention_days), None
