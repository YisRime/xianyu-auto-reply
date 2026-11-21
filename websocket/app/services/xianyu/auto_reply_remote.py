"""远程默认回复。由自动回复入口组合，保持现有调用签名。"""
from __future__ import annotations

from typing import Optional

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models.user_setting import UserSetting
from common.utils.default_reply_api import call_reply_api


class AutoReplyRemoteMixin:
    """封装自动回复remote相关处理。"""

    async def _do_api_default_reply(
        self,
        session: AsyncSession,
        send_message: str,
        api_url: str,
        api_timeout,
        settings: dict,
        settings_item_id: Optional[str],
        chat_id: str,
        send_user_id: str,
        send_user_name: str,
        item_id: Optional[str],
        msg_time: str,
        reply_trace: Optional[dict],
    ) -> Optional[str]:
        """调用外部 API 获取默认回复内容并处理结果。

        由 get_default_reply 在持有会话级去重锁（或降级无锁）时调用：
        - 调用失败/超时/无有效内容：返回 None，不回复，且不记录 reply_once（便于下次重试）；
        - 调用成功：按需记录 reply_once，返回回复文本（下游按 ###### 分段发送）。
        """
        api_reply = await call_reply_api(
            account_id=self.cookie_id,
            message=send_message,
            api_url=api_url,
            timeout=api_timeout,
            chat_id=chat_id,
            item_id=item_id or "",
            send_user_id=send_user_id,
            send_user_name=send_user_name,
            msg_time=msg_time,
        )

        # 失败/无有效内容：不回复（不记录 reply_once，便于下次重试）
        if not api_reply or not api_reply.strip():
            logger.info(f"【{self.cookie_id}】默认回复API未返回有效内容,不进行回复")
            if reply_trace is not None:
                reply_trace["process_status"] = "skipped"
                reply_trace["decision_reason"] = "no_rule_matched"
                reply_trace.setdefault("context_snapshot", {})["default_reply_api_url"] = api_url
            return None

        # 调用成功后再记录 reply_once
        if settings.get("reply_once", False) and chat_id:
            await self._record_user_replied(session, self.cookie_id, chat_id, settings_item_id)
            logger.info(f"【{self.cookie_id}】记录默认回复(API): chat_id={chat_id}, item_id={settings_item_id}")

        logger.info(f"【{self.cookie_id}】使用API默认回复: {api_reply[:50]}")
        if reply_trace is not None:
            reply_trace["reply_mode"] = "text"
            reply_trace["reply_text"] = api_reply
            reply_trace["reply_segments"] = self._build_text_reply_segments(api_reply)
            reply_trace.setdefault("context_snapshot", {})["default_reply_api_url"] = api_url
        return api_reply
