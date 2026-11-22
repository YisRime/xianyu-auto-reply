"""
FastAPI依赖注入模块

功能：
1. 提供数据库会话依赖
2. 提供各种服务类的依赖注入
3. 单用户本地部署：不再校验登录令牌，所有接口固定使用内置管理员身份
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.db.session import async_session_maker
from common.models import User, UserRole


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话"""
    async with async_session_maker() as session:
        yield session


async def get_current_user(session: AsyncSession = Depends(get_db_session)) -> User:
    """返回内置管理员账号。

    单用户本地部署已移除登录取证流程，不再解析任何令牌；
    保留函数名与依赖签名，避免改动全部业务路由。
    """
    result = await session.execute(
        select(User).where(User.role == UserRole.ADMIN).order_by(User.id).limit(1)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="内置管理员账号不存在",
        )
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """获取当前用户（单用户部署，恒为内置管理员）"""
    return current_user


async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """获取当前管理员用户（单用户部署，恒为内置管理员）"""
    return current_user


# ==================== Service 依赖注入 ====================

async def get_account_service(session: AsyncSession = Depends(get_db_session)):
    """获取账号服务"""
    from app.services.account_service import AccountService
    return AccountService(session)


async def get_item_service(session: AsyncSession = Depends(get_db_session)):
    """获取商品服务"""
    from app.services.item_service import ItemService
    return ItemService(session)


async def get_order_service(session: AsyncSession = Depends(get_db_session)):
    """获取订单服务"""
    from app.services.order_service import OrderService
    return OrderService(session)


async def get_card_service(session: AsyncSession = Depends(get_db_session)):
    """获取卡券服务"""
    from app.services.card_service import CardService
    return CardService(session)


async def get_default_reply_service(session: AsyncSession = Depends(get_db_session)):
    """获取默认回复服务"""
    from app.services.default_reply_service import DefaultReplyService
    return DefaultReplyService(session)


async def get_keyword_service(session: AsyncSession = Depends(get_db_session)):
    """获取关键词服务"""
    from app.services.keyword_service import KeywordService
    return KeywordService(session)


async def get_notification_channel_service(session: AsyncSession = Depends(get_db_session)):
    """获取通知渠道服务"""
    from app.services.notification_service import NotificationChannelService
    return NotificationChannelService(session)


async def get_system_setting_service(session: AsyncSession = Depends(get_db_session)):
    """获取系统设置服务"""
    from app.services.system_setting_service import SystemSettingService
    return SystemSettingService(session)



async def get_risk_log_service(session: AsyncSession = Depends(get_db_session)):
    """获取风控日志服务"""
    from app.services.risk_control_log_service import RiskControlLogService
    return RiskControlLogService(session)


async def get_account_login_log_service(session: AsyncSession = Depends(get_db_session)):
    """获取账号登录日志服务"""
    from app.services.account_login_log_service import AccountLoginLogService
    return AccountLoginLogService(session)


async def get_email_log_service(session: AsyncSession = Depends(get_db_session)):
    """获取邮件日志服务"""
    from app.services.email_log_service import EmailLogService
    return EmailLogService(session)


async def get_db_backup_log_service(session: AsyncSession = Depends(get_db_session)):
    """获取数据库备份日志服务"""
    from app.services.db_backup_log_service import DbBackupLogService
    return DbBackupLogService(session)


async def get_ai_reply_service(session: AsyncSession = Depends(get_db_session)):
    """获取AI回复设置服务"""
    from app.services.ai_reply_service import AIReplySettingsService
    return AIReplySettingsService(session)


async def get_ai_conversation_service(session: AsyncSession = Depends(get_db_session)):
    """获取AI对话服务"""
    from app.services.ai_conversation_service import AIConversationService
    return AIConversationService(session)


async def get_message_notification_service(session: AsyncSession = Depends(get_db_session)):
    """获取消息通知服务"""
    from app.services.notification_service import MessageNotificationService
    return MessageNotificationService(session)


async def get_blacklist_service(session: AsyncSession = Depends(get_db_session)):
    """获取黑名单服务"""
    from app.services.blacklist_service import BlacklistService
    return BlacklistService(session)


async def get_card_dock_service(session: AsyncSession = Depends(get_db_session)):
    """获取分销卡券对接服务"""
    from app.services.card_dock_service import CardDockService
    return CardDockService(session)
