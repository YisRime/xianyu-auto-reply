"""
系统设置服务

功能：
1. 系统设置CRUD操作
2. 敏感设置过滤
3. 键值对存储和查询
4. XSS防护
"""
from __future__ import annotations

from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from common.models.system_setting import SystemSetting
from common.models.user_setting import UserSetting
from common.services.registration_policy import REGISTRATION_ENABLED_KEY
from common.services.email_domain_policy import EMAIL_DOMAIN_DEFAULTS
from common.services.system_setting_validation import parse_boolean_setting
from common.utils.text_utils import escape_xss

# 敏感配置不通过通用系统设置接口返回或修改。
# 服务间令牌由启动流程自动维护，避免在管理页面暴露或被误改。
SENSITIVE_KEYS = {
    "admin_password_hash",
    "security.internal_api_token",
    "security.jwt_secret_key",
}

DEFAULT_LOGIN_SYSTEM_TITLE = "高效专业的\n闲鱼自动化管理平台"
DEFAULT_LOGIN_SYSTEM_DESCRIPTION = "自动回复、智能客服、订单管理、数据分析，一站式解决闲鱼运营难题"


DEFAULT_SYSTEM_SETTINGS: dict[str, tuple[str, str | None]] = {
    **EMAIL_DOMAIN_DEFAULTS,
    REGISTRATION_ENABLED_KEY: ("false", "是否允许新用户自助注册（关闭后拒绝注册及注册验证码发送、验证）"),
    "login.system_name": ("闲鱼管理系统", "登录页系统名称"),
    "login.system_title": (DEFAULT_LOGIN_SYSTEM_TITLE, "登录页系统标题"),
    "login.system_description": (DEFAULT_LOGIN_SYSTEM_DESCRIPTION, "登录页系统描述"),
    "theme.effect": ("solid", "系统主题效果（solid-纯色，gradient-炫彩）"),
    "theme.color_preset": ("ocean", "系统主题颜色预设"),
    "theme.font_family": ("system", "系统主题字体预设"),
    "log.retention_days": ("7", "日志保留天数（所有模块生效，修改后实时刷新各服务日志策略）"),
    # 重发货触发关键字：原个人设置项，用户系统移除后改为全局系统设置
    "redelivery_trigger_keyword": ("", "重发货触发关键字（闲鱼聊天中发送「关键字+订单号」触发重新发货，留空关闭）"),
    "account.face_verify_timeout_disable": ("true", "人脸验证超时是否自动禁用账号"),
    # 代理设置：用于配置网络请求的代理 API URL 和启用开关
    # api_url 默认空字符串表示未配置；enabled 默认 false 表示不启用
    "proxy.api_url": ("", "代理 API 的 URL（可能较长，用于配置外部代理服务）"),
    "proxy.enabled": ("false", "是否启用代理（true/false）"),
    # 用户到期/续期设置
    # renew_month_price：续期一个月的价格（元），空表示未配置（续期功能不可用）
    # register_default_days：注册用户默认有效天数，空表示注册不设置到期日（永不过期）
    "user.renew_month_price": ("", "用户续期一个月的价格（元），空=未配置"),
    "user.register_default_days": ("", "注册用户默认有效天数（空=不设置到期日）"),
    # real_mouse 过滑块本地/远程排队权重（默认 1:1，多来源同时排队时按比例放行）
    "captcha.real_mouse_weight_local": ("1", "real_mouse过滑块本地排队权重"),
    "captcha.real_mouse_weight_remote": ("1", "real_mouse过滑块远程排队权重"),
    "captcha.block_remote_calls": ("true", "是否禁止外部远程调用backend-web过滑块接口"),
    "captcha.local_slider_disabled": (
        "false",
        "本机是否停止处理滑块；缓存缺失时仍请求Token接口",
    ),
    "captcha.remote_processing_max": ("20", "远程调用允许的最大处理中滑块日志数，0=不限制"),
    "captcha.remote_cooldown_seconds": ("600", "远程调用达到处理中上限后的冷却秒数，0=不冷却"),
    "captcha.remote_cooldown_until": ("0", "远程过滑块调用冷却截止时间戳"),
    "captcha.slider_mode": ("browser", "滑块滑动方式：browser/real_mouse"),
    "token.remote_url": ("", "Token远程接口URL"),
    "token.remote_secret_key": ("", "Token远程接口秘钥"),
}

# 不需要XSS转义的键（布尔值、数字等）
NO_ESCAPE_KEYS = {
    *EMAIL_DOMAIN_DEFAULTS,
    REGISTRATION_ENABLED_KEY,
    "show_default_login_info",
    "login_captcha_enabled",
    "login.system_name",
    "login.system_title",
    "login.system_description",
    "theme.effect",
    "theme.color_preset",
    "theme.font_family",
    "navigation.hidden_menu_keys",
    "smtp_port",
    "smtp_use_tls",
    "smtp_use_ssl",
    "distribution.fee_type",
    "distribution.fee_rate",
    "alipay.app_id",
    "alipay.private_key",
    "alipay.alipay_public_key",
    "alipay.gateway_url",
    "alipay.notify_url",
    "zzcode.pid",
    "zzcode.key",
    "zzcode.gateway",
    "zzcode.notify_url",
    "zzcode.return_url",
    "zzcode.pay_types",
    "withdraw.notify_email",
    "withdraw.min_amount",
    "log.retention_days",
    "redelivery_trigger_keyword",
    "account.face_verify_timeout_disable",
    # 用户到期/续期设置：均为数字字符串，无需 XSS 转义
    "user.renew_month_price",
    "user.register_default_days",
    # 代理设置：URL 含 :、/、?、&、= 等字符不能被 XSS 转义；布尔字符串"true"/"false"也无需转义
    "proxy.api_url",
    "proxy.enabled",
    # 远程过滑块配置：URL 含 :// 等字符、秘钥为随机串，均不能被 XSS 转义
    "captcha.remote_service_url",
    "captcha.remote_secret_key",
    # 是否传递账号Cookie：布尔字符串"true"/"false"，无需转义
    "captcha.remote_pass_cookies",
    "captcha.block_remote_calls",
    "captcha.local_slider_disabled",
    "captcha.remote_processing_max",
    "captcha.remote_cooldown_seconds",
    "captcha.remote_cooldown_until",
    "captcha.slider_mode",
    # real_mouse 排队权重：数字字符串，无需 XSS 转义
    "captcha.real_mouse_weight_local",
    "captcha.real_mouse_weight_remote",
    # 服务间令牌不会经由通用设置接口写入；加入免转义集合，防止内部维护时被破坏。
    "security.internal_api_token",
}


class SystemSettingService:
    """Provides CRUD helpers for global system settings."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def rollback(self) -> None:
        """尽力回滚当前会话；回滚失败时记录异常并交由会话关闭释放连接。"""
        try:
            await self.session.rollback()
        except Exception as exc:  # noqa: BLE001 - 回滚失败不能覆盖原始业务异常。
            logger.opt(exception=exc).error(
                "系统设置数据库会话回滚失败：exception_type={} exception={}",
                type(exc).__name__,
                exc,
            )

    async def ensure_default_settings(self) -> None:
        """幂等补齐缺失默认配置，并处理多个请求首次补齐时的重复键冲突。

        Args:
            无额外参数，使用当前请求的数据库会话。
        Returns:
            无返回值；保留已有配置，数据库异常记录后继续抛出。
        """
        try:
            for attempt in range(3):
                existing_stmt = select(SystemSetting.key).where(
                    SystemSetting.key.in_(tuple(DEFAULT_SYSTEM_SETTINGS))
                )
                existing_result = await self.session.execute(existing_stmt)
                existing_keys = set(existing_result.scalars().all())
                missing_records = [
                    SystemSetting(key=key, value=value, description=description)
                    for key, (value, description) in DEFAULT_SYSTEM_SETTINGS.items()
                    if key not in existing_keys
                ]
                if not missing_records:
                    return

                try:
                    # 保存点仅回滚本次补齐，避免已加载的登录用户对象被整体回滚过期。
                    async with self.session.begin_nested():
                        self.session.add_all(missing_records)
                        await self.session.flush()
                except IntegrityError as exc:
                    if attempt == 2:
                        raise
                    # 保存点已回滚；结束只读事务，下一次查询获取 MySQL 的新快照。
                    await self.session.commit()
                    logger.warning(
                        "默认系统设置补齐遇到并发冲突，将重新查询：attempt={} keys={} exception_type={} exception={}",
                        attempt + 1, [record.key for record in missing_records],
                        type(exc).__name__, exc,
                    )
                    continue

                await self.session.commit()
                logger.info("默认系统设置已补齐：keys={}", [record.key for record in missing_records])
                return
        except Exception as exc:
            await self.rollback()
            logger.opt(exception=exc).error(
                "补齐默认系统设置失败：exception_type={} exception={}",
                type(exc).__name__, exc,
            )
            raise

    async def migrate_legacy_redelivery_keyword(self) -> None:
        """将旧版按用户保存的重发货触发关键字迁移到全局系统设置。

        用户系统移除后，该配置由「个人设置」改为「系统设置」。仅当系统设置
        为空时从任意用户的旧记录中回填一次，保证升级后配置不丢失。
        """
        key = "redelivery_trigger_keyword"
        try:
            setting_stmt = select(SystemSetting).where(SystemSetting.key == key)
            setting = (await self.session.execute(setting_stmt)).scalars().first()
            if setting is not None and str(setting.value or "").strip():
                return

            legacy_stmt = (
                select(UserSetting.value)
                .where(UserSetting.key == key, UserSetting.value != "")
                .limit(1)
            )
            legacy_value = str((await self.session.execute(legacy_stmt)).scalars().first() or "").strip()
            if not legacy_value:
                return

            if setting is None:
                self.session.add(
                    SystemSetting(key=key, value=legacy_value, description="重发货触发关键字")
                )
            else:
                setting.value = legacy_value
            await self.session.commit()
            logger.info("已将旧版个人设置中的重发货触发关键字迁移到系统设置")
        except Exception as exc:
            await self.rollback()
            logger.opt(exception=exc).error(
                "迁移重发货触发关键字失败：exception_type={} exception={}",
                type(exc).__name__,
                exc,
            )

    async def list_settings(self, include_sensitive: bool = False) -> dict[str, str]:
        await self.ensure_default_settings()
        stmt = select(SystemSetting)
        result = await self.session.execute(stmt)
        settings: dict[str, str] = {}
        for entry in result.scalars().all():
            # JWT 密钥和服务间令牌即使内部调用 include_sensitive=True 也不返回。
            if entry.key in {"security.internal_api_token", "security.jwt_secret_key"}:
                continue
            if not include_sensitive and entry.key in SENSITIVE_KEYS:
                continue
            settings[entry.key] = entry.value
        # 只规范化本次返回值，保留历史设置记录；各客户端统一读取 true/false。
        settings[REGISTRATION_ENABLED_KEY] = (
            "true" if parse_boolean_setting(settings.get(REGISTRATION_ENABLED_KEY)) else "false"
        )
        password_login_mode = str(settings.get("password_login.mode") or "").strip().lower()
        settings["password_login.mode"] = (
            password_login_mode
            if password_login_mode in {"protocol", "browser"}
            else "browser"
        )
        slider_mode = str(settings.get("captcha.slider_mode") or "").strip().lower()
        settings["captcha.slider_mode"] = (
            slider_mode if slider_mode in {"browser", "real_mouse"} else "browser"
        )
        return settings

    async def set_setting(self, key: str, value: str, description: str | None = None) -> None:
        if key in SENSITIVE_KEYS:
            raise ValueError("敏感设置不能通过通用接口修改")
        try:
            stmt = select(SystemSetting).where(SystemSetting.key == key)
            result = await self.session.execute(stmt)
            record = result.scalars().first()

            # 对非特殊键的值进行XSS转义
            safe_value = value if key in NO_ESCAPE_KEYS else escape_xss(value)
            safe_description = escape_xss(description) if description else None

            if record:
                record.value = safe_value
                if description is not None:
                    record.description = safe_description
            else:
                record = SystemSetting(key=key, value=safe_value, description=safe_description)

            self.session.add(record)
            await self.session.commit()
        except Exception as exc:
            await self.rollback()
            logger.opt(exception=exc).error(
                "保存系统设置失败：key={} exception_type={} exception={}",
                key,
                type(exc).__name__,
                exc,
            )
            raise

    async def set_settings(self, settings: dict[str, tuple[str, str | None]]) -> None:
        """在同一事务中批量保存系统设置。

        Args:
            settings: ``{设置键: (设置值, 设置说明)}`` 映射。

        Returns:
            无返回值；全部设置成功后统一提交。
        """
        if not settings:
            return

        sensitive_keys = set(settings).intersection(SENSITIVE_KEYS)
        if sensitive_keys:
            raise ValueError("敏感设置不能通过通用接口修改")
        try:
            stmt = select(SystemSetting).where(SystemSetting.key.in_(tuple(settings.keys())))
            result = await self.session.execute(stmt)
            records = {record.key: record for record in result.scalars().all()}

            for key, (value, description) in settings.items():
                safe_value = value if key in NO_ESCAPE_KEYS else escape_xss(value)
                safe_description = escape_xss(description) if description else None
                record = records.get(key)
                if record:
                    record.value = safe_value
                    if description is not None:
                        record.description = safe_description
                else:
                    record = SystemSetting(
                        key=key,
                        value=safe_value,
                        description=safe_description,
                    )
                self.session.add(record)

            await self.session.commit()
        except Exception as exc:
            await self.rollback()
            logger.opt(exception=exc).error(
                "批量保存系统设置失败：keys={} exception_type={} exception={}",
                sorted(settings),
                type(exc).__name__,
                exc,
            )
            raise
