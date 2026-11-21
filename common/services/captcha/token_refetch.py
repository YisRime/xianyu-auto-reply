"""
滑块验证链接刷新模块（公共）

用途：
    当 punish?x5secdata 验证链接因等待并发槽位 / 浏览器启动而过期（页面显示
    "抱歉，页面访问出现了问题"）时，凭账号 Cookie 同步重新请求 token 接口，拿到一个
    新鲜的验证链接；若此时风控已解除（接口直接下发 accessToken），则返回 token 可用标志，
    调用方据此可跳过滑块流程。

说明：
    本机处理（cookie_token_manager._request_captcha_url_sync）与远程过滑块接口
    （internal /captcha/solve）共用本逻辑，避免在多处重复实现（项目开发规范第 36 条）。
    使用的 token 接口（网页 / 远程接口）跟随系统设置 token.api_mode，每次实时查库，
    远程配置优先使用账号所属用户的个人配置，与 WebSocket 主流程口径一致。
"""

import time

import requests
from loguru import logger

from common.services.captcha.token_response import (
    extract_token_captcha_url,
    is_token_expired_response,
)
from common.services.im_token_api import extract_im_access_token
from common.services.token_api_mode import (
    TOKEN_API_MODE_WEB,
    get_token_api_mode_label,
    get_token_api_name,
    load_token_api_mode_sync,
)
from common.utils.xianyu_utils import generate_sign

# token 接口地址前缀与 appKey
_TOKEN_API_BASE_URL = "https://h5api.m.goofish.com/h5"
_APP_KEY = "34839810"
# 重取链接在浏览器验证的 20 秒总超时内执行，必须预留导航和滑动时间。
_TOKEN_REFETCH_TOTAL_TIMEOUT_SECONDS = 10.0
_TOKEN_API_CONNECT_TIMEOUT_SECONDS = 3.0
# 重取滑块验证链接场景的风控日志事件描述前缀


def _post_token_api(
    cookie_id: str,
    api_mode: str,
    cookies: dict[str, str],
    cookies_str: str,
    device_id: str,
    request_timeout_seconds: float,
) -> tuple[object, dict[str, str]]:
    """同步请求一次 token 接口。

    Args:
        cookie_id: 账号标识（仅用于日志）
        api_mode: Token 获取方式（网页）
        cookies: Cookie 字典（需含 _m_h5_tk 用于签名）
        cookies_str: Cookie 原始字符串（作为请求头 cookie）
        device_id: 设备 ID（拼入请求体 deviceId）
        request_timeout_seconds: 本次 HTTP 请求的剩余超时预算。

    Returns:
        ``(响应JSON, 接口下发的Cookie)``
    """
    api_name = get_token_api_name(api_mode)
    timestamp = str(int(time.time() * 1000))
    params = {
        "jsv": "2.7.2",
        "appKey": _APP_KEY,
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
    # deviceId 为空时也照常请求：签名只依赖 _m_h5_tk + data_val + 时间戳
    data_val = '{"appKey":"444e9908a51d1cb236a27862abc769c9","deviceId":"' + (device_id or "") + '"}'
    data = {"data": data_val}

    token = cookies.get("_m_h5_tk", "").split("_")[0] if cookies.get("_m_h5_tk") else ""
    params["sign"] = generate_sign(params["t"], token, data_val)

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
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "referer": "https://www.goofish.com/",
        "origin": "https://www.goofish.com",
        "cookie": cookies_str.replace("\n", "").replace("\r", "") if cookies_str else "",
    }

    logger.info(
        f"【{cookie_id}】重新请求新鲜的滑块验证链接（{get_token_api_mode_label(api_mode)}）..."
    )
    connect_timeout = min(
        _TOKEN_API_CONNECT_TIMEOUT_SECONDS,
        max(0.1, request_timeout_seconds / 2),
    )
    read_timeout = max(0.1, request_timeout_seconds - connect_timeout)
    resp = requests.post(
        f"{_TOKEN_API_BASE_URL}/{api_name}/1.0/",
        params=params,
        data=data,
        headers=headers,
        timeout=(connect_timeout, read_timeout),
    )
    res_json = resp.json()
    try:
        response_cookies = dict(resp.cookies.get_dict() or {})
    except Exception:
        response_cookies = {}
    return res_json, response_cookies


def _request_token_api_with_expiry_retry(
    cookie_id: str,
    api_mode: str,
    cookies: dict[str, str],
    cookies_str: str,
    device_id: str,
    deadline: float,
) -> tuple[object, dict[str, str], dict[str, str], str]:
    """请求指定 Token 接口，并在 mtop 令牌过期时自动重试一次。

    Args:
        cookie_id: 账号标识（仅用于日志）。
        api_mode: 本轮使用的 Token 接口方式。
        cookies: 当前 Cookie 字典。
        cookies_str: 当前 Cookie 字符串。
        device_id: 设备 ID。
        deadline: 本轮重取链接的单调时钟截止时间。

    Returns:
        ``(最终响应JSON, 累计响应Cookie, 最新Cookie字典, 最新Cookie字符串)``。
    """
    current_cookies = dict(cookies)
    current_cookies_str = cookies_str
    response_cookie_updates: dict[str, str] = {}
    response_json: object = None

    for attempt in range(2):
        remaining_seconds = deadline - time.monotonic()
        if remaining_seconds <= 0:
            if response_cookie_updates:
                logger.warning(
                    f"【{cookie_id}】{get_token_api_mode_label(api_mode)}重试前总超时预算已用尽，"
                    "保留首次响应下发的Cookie"
                )
                break
            raise requests.Timeout("Token验证链接重取已超过总超时预算")
        try:
            response_json, response_cookies = _post_token_api(
                cookie_id,
                api_mode,
                current_cookies,
                current_cookies_str,
                device_id,
                remaining_seconds,
            )
        except Exception as request_error:
            if not response_cookie_updates:
                raise
            logger.warning(
                f"【{cookie_id}】{get_token_api_mode_label(api_mode)}使用新Cookie重试失败，"
                f"保留首次响应下发的Cookie: "
                f"{type(request_error).__name__}: {request_error}"
            )
            break
        if response_cookies:
            response_cookie_updates.update(response_cookies)
            current_cookies.update(response_cookies)
            current_cookies_str = "; ".join(
                f"{key}={value}" for key, value in current_cookies.items()
            )

        if (
            attempt == 0
            and is_token_expired_response(response_json)
            and response_cookies.get("_m_h5_tk")
        ):
            logger.warning(
                f"【{cookie_id}】重取验证链接时命中令牌过期，"
                "使用接口下发的新 _m_h5_tk 重试一次"
            )
            continue
        break

    return (
        response_json,
        response_cookie_updates,
        current_cookies,
        current_cookies_str,
    )


def request_fresh_captcha_url(
    cookie_id: str,
    cookies: dict[str, str],
    cookies_str: str,
    device_id: str,
) -> dict[str, object]:
    """凭账号 Cookie 重新请求 token 接口，提取新鲜的滑块验证链接。

    命中 mtop 令牌过期时，用接口下发的新 _m_h5_tk 合并后自动重试一次，
    与其他取 Token 路径的处理口径保持一致。

    Args:
        cookie_id: 账号标识，用于选择所属用户配置及日志定位。
        cookies: Cookie 字典（需含 _m_h5_tk 用于签名）
        cookies_str: Cookie 原始字符串（作为请求头 cookie）
        device_id: 设备 ID（拼入请求体 deviceId）

    Returns:
        dict：
          - token_ok (bool): 风控是否已解除、token 直接可用（无需滑块）
          - new_token (str|None): token_ok 时下发的 accessToken
          - device_id (str|None): token_ok 时远程接口返回的设备标识
          - api_mode (str|None): token_ok 时远程接口实际使用的接口方式
          - new_cookies (dict): 接口下发的刷新 cookie（可能为空）
          - fresh_url (str|None): 新鲜的验证链接（需要继续过滑块时）
          - error_message (str|None): 远程配置或调用失败的具体原因
    """
    result: dict[str, object] = {
        "token_ok": False,
        "new_token": None,
        "device_id": None,
        "api_mode": None,
        "new_cookies": {},
        "fresh_url": None,
        "error_message": None,
    }
    try:
        deadline = time.monotonic() + _TOKEN_REFETCH_TOTAL_TIMEOUT_SECONDS
        current_cookies = dict(cookies)
        current_cookies_str = cookies_str
        try:
            primary_response, response_cookies, current_cookies, current_cookies_str = (
                _request_token_api_with_expiry_retry(
                    cookie_id,
                    TOKEN_API_MODE_WEB,
                    current_cookies,
                    current_cookies_str,
                    device_id,
                    deadline,
                )
            )
        except Exception:
            return result
        result["new_cookies"] = dict(response_cookies)
        new_token = extract_im_access_token(primary_response)
        if new_token:
            logger.info(
                f"【{cookie_id}】重新请求 token 已成功（风控已解除），无需滑块验证"
            )
            result["token_ok"] = True
            result["new_token"] = new_token
            return result

        new_url = extract_token_captcha_url(primary_response)
        if new_url:
            logger.info(f"【{cookie_id}】已获取新鲜验证链接")
            result["fresh_url"] = new_url
            return result

        logger.info(f"【{cookie_id}】重新请求未返回验证链接（可能已不需要验证）")

        return result
    except Exception as e:  # noqa: BLE001 - 同步滑块线程必须返回结构化错误，不能让异常逃逸。
        result["error_message"] = f"重新获取滑块验证链接失败：{type(e).__name__}: {e}"
        logger.opt(exception=e).error(
            "【{}】重新获取滑块验证链接失败：exception_type={} exception={}",
            cookie_id,
            type(e).__name__,
            e,
        )
        return result
