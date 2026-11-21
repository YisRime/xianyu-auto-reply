"""
Token 获取接口方式公共模块（仅保留网页接口）。

项目已移除远程 Token 接口，Token 一律通过闲鱼官方 mtop 网页接口获取。
"""
from __future__ import annotations

TOKEN_API_MODE_WEB = "web"
TOKEN_API_MODES = (TOKEN_API_MODE_WEB,)
DEFAULT_TOKEN_API_MODE = TOKEN_API_MODE_WEB

TOKEN_API_NAMES = {
    TOKEN_API_MODE_WEB: "mtop.taobao.idlemessage.pc.login.token",
}

TOKEN_API_MODE_LABELS = {
    TOKEN_API_MODE_WEB: "网页接口",
}


def normalize_token_api_mode(value: object) -> str:
    """归一化为固定的网页接口方式。"""
    return TOKEN_API_MODE_WEB


def get_token_api_name(mode: object = None) -> str:
    """取接口方式对应的 mtop 接口名（固定网页接口）。"""
    return TOKEN_API_NAMES[TOKEN_API_MODE_WEB]


def get_token_api_mode_label(mode: object = None) -> str:
    """取接口方式的中文名称（固定网页接口）。"""
    return TOKEN_API_MODE_LABELS[TOKEN_API_MODE_WEB]


async def load_token_api_mode(log_tag: str = "") -> str:
    """读取 Token 获取方式（固定网页接口，保留异步签名兼容调用方）。"""
    return TOKEN_API_MODE_WEB


def load_token_api_mode_sync(log_tag: str = "") -> str:
    """读取 Token 获取方式（固定网页接口，保留同步签名兼容调用方）。"""
    return TOKEN_API_MODE_WEB
