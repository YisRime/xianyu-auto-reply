"""
安全工具模块

功能：
1. 密码哈希和验证（支持bcrypt和pbkdf2_sha256）
2. 随机秘钥生成
"""
from __future__ import annotations

import secrets
import string

import bcrypt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# 秘钥生成可用字符集：大小写字母 + 数字
_SECRET_KEY_ALPHABET = string.ascii_letters + string.digits


def generate_secret_key(length: int = 32) -> str:
    """生成随机分销/提货秘钥（大小写字母+数字）

    使用 secrets 保证密码学随机性，全局唯一性由数据库 UNIQUE 约束 + 生成端重试保证。

    Args:
        length: 秘钥长度，默认 32 位

    Returns:
        随机秘钥字符串
    """
    return ''.join(secrets.choice(_SECRET_KEY_ALPHABET) for _ in range(length))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if hashed_password.startswith("$2") and len(hashed_password) >= 4:
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        except ValueError:
            return False
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)
