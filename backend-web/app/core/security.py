"""安全模块（backend-web 薄封装层）。

单用户本地部署已移除登录与 JWT 流程，本模块仅保留密码哈希/校验能力。
"""
from __future__ import annotations

from common.utils import security as _common_security

# 密码相关函数无配置依赖，直接复用 common 实现
verify_password = _common_security.verify_password
get_password_hash = _common_security.get_password_hash
