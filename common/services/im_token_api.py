"""
闲鱼 IM Token API 客户端。

功能：
1. 使用账号 Cookie 和指定 Device ID 构造签名请求
2. 支持网页接口 / 远程接口两种 Token 获取方式
3. 返回接口响应及 Set-Cookie 内容
4. 统一解析成功响应中的 accessToken
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any

import aiohttp
from loguru import logger

from common.services.token_api_mode import (
    DEFAULT_TOKEN_API_MODE,
    TOKEN_API_MODE_WEB,
    get_token_api_name,
    normalize_token_api_mode,
)
from common.utils.cookie_refresh import is_session_expired_error
from common.utils.xianyu_utils import generate_sign, trans_cookies

IM_TOKEN_API_BASE_URL = "https://h5api.m.goofish.com/h5"


def build_im_token_api_url(api_mode: str = DEFAULT_TOKEN_API_MODE) -> str:
    """按接口方式拼出 Token 接口地址。

    Args:
        api_mode: Token 获取方式（网页）
    Returns:
        完整的 mtop 接口地址
    """
    return f"{IM_TOKEN_API_BASE_URL}/{get_token_api_name(api_mode)}/1.0/"


@dataclass(frozen=True, slots=True)
class ImTokenApiResult:
    """IM Token API 的原始请求结果。"""

    response_json: Any
    response_cookies: dict[str, str]
    status_code: int
    duration_seconds: float
    api_mode: str = DEFAULT_TOKEN_API_MODE
    device_id: str = ""
    # 远程失败原因独立保存；ret仅保留闲鱼真实协议错误，避免普通服务报错误触发滑块。
    remote_failure_message: str = ""


def extract_im_access_token(response_json: Any) -> str | None:
    """从成功响应中提取 IM accessToken。

    Args:
        response_json: IM Token API 返回的 JSON 数据。

    Returns:
        成功时返回非空 accessToken，否则返回 None。
    """
    if not isinstance(response_json, dict):
        return None

    ret_value = response_json.get("ret", []) or []
    if isinstance(ret_value, str):
        ret_value = [ret_value]
    if not any("SUCCESS::调用成功" in str(item) for item in ret_value):
        return None

    data = response_json.get("data")
    if not isinstance(data, dict):
        return None
    access_token = data.get("accessToken")
    return access_token if isinstance(access_token, str) and access_token else None


def is_session_expired_token_result(result: ImTokenApiResult) -> bool:
    """判断取 Token 结果是否为 Session 过期（Cookie 已失效）。

    同时检查响应体与远程接口失败原因，确保 Session 过期信息不会因接口封装方式变化而漏判。

    Args:
        result: 取 Token 的请求结果。

    Returns:
        True 表示 Session 已过期，需要走密码登录续期。
    """
    response_json = result.response_json
    if isinstance(response_json, dict):
        response_text = json.dumps(response_json, ensure_ascii=False, separators=(',', ':'))
        if is_session_expired_error([response_text]):
            return True

    return bool(
        result.remote_failure_message
        and is_session_expired_error([result.remote_failure_message])
    )


async def request_im_token(
    cookies_str: str,
    device_id: str,
    *,
    api_mode: str = DEFAULT_TOKEN_API_MODE,
    timeout_seconds: int = 30,
) -> ImTokenApiResult:
    """调用闲鱼 IM Token API。

    Args:
        cookies_str: 账号 Cookie 字符串。
        device_id: 本次请求必须使用的 Device ID。
        api_mode: Token 获取方式（网页接口）。
        timeout_seconds: HTTP 请求总超时秒数。

    Returns:
        包含响应 JSON、响应 Cookie、状态码、耗时和本次接口方式的结果。

    Raises:
        aiohttp.ClientError: 网络请求失败。
        asyncio.TimeoutError: 请求超时。
        ValueError: 响应无法解析为 JSON。
    """
    normalized_mode = normalize_token_api_mode(api_mode)
    api_name = get_token_api_name(normalized_mode)
    timestamp = str(int(time.time() * 1000))
    params = {
        "jsv": "2.7.2",
        "appKey": "34839810",
        "t": timestamp,
        "sign": "",
        "v": "1.0",
        "type": "originaljson",
        "accountSite": "xianyu",
        "dataType": "json",
        "timeout": "20000",
        "api": api_name,
        "sessionOption": "AutoLoginOnly",
        "dangerouslySetWindvaneParams": "%5Bobject%20Object%5D",
        "smToken": "token",
        "queryToken": "sm",
        "sm": "sm",
        "spm_cnt": "a21ybx.im.0.0",
        "spm_pre": "a21ybx.home.sidebar.1.4c053da6vYwnmf",
        "log_id": "4c053da6vYwnmf",
    }
    data_value = (
        '{"appKey":"444e9908a51d1cb236a27862abc769c9","deviceId":"'
        + device_id
        + '"}'
    )
    cookies = trans_cookies(cookies_str)
    m_h5_token = cookies.get("_m_h5_tk", "")
    signing_token = m_h5_token.split("_")[0] if m_h5_token else ""
    params["sign"] = generate_sign(timestamp, signing_token, data_value)

    headers = {
        "accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/139.0.0.0 Safari/537.36"
        ),
        "referer": "https://www.goofish.com/",
        "origin": "https://www.goofish.com",
        "cookie": cookies_str.replace("\n", "").replace("\r", "") if cookies_str else "",
    }

    started_at = time.time()
    async with aiohttp.ClientSession() as session, session.post(
        build_im_token_api_url(normalized_mode),
        params=params,
        data={"data": data_value},
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=timeout_seconds),
    ) as response:
        # 风控响应的 content-type 可能不是 json，统一放开校验避免解析异常
        response_json = await response.json(content_type=None)
        response_cookies: dict[str, str] = {}
        for cookie_header in response.headers.getall("set-cookie", []):
            if "=" not in cookie_header:
                continue
            name, value = cookie_header.split(";", 1)[0].split("=", 1)
            response_cookies[name.strip()] = value.strip()
        return ImTokenApiResult(
            response_json=response_json,
            response_cookies=response_cookies,
            status_code=response.status,
            duration_seconds=time.time() - started_at,
            api_mode=normalized_mode,
            device_id=device_id,
        )


async def request_im_token_with_fallback(
    cookies_str: str,
    device_id: str,
    *,
    api_mode: str = DEFAULT_TOKEN_API_MODE,
    timeout_seconds: int = 600,
    log_tag: str = "",
) -> ImTokenApiResult:
    """调用闲鱼官方 mtop 网页接口获取 IM Token。"""
    return await request_im_token(
        cookies_str,
        device_id,
        api_mode=TOKEN_API_MODE_WEB,
        timeout_seconds=timeout_seconds,
    )
