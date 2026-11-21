import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.security import get_password_hash, verify_password
from common.models.user import User
from common.schemas.common import ApiResponse
from common.schemas.user import UserPublic, UserUpdate
from common.utils.security import generate_secret_key as _generate_secret_key
from app.services.user_service import UserService


def _generate_dock_code(length: int = 8) -> str:
    """生成随机对接码（大写字母+数字）"""
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

router = APIRouter(tags=["users"])


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    current_password: str
    new_password: str


@router.get("/me", response_model=UserPublic)
async def read_current_user(current_user: User = Depends(deps.get_current_active_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)


class RenewMembershipRequest(BaseModel):
    """账户续期请求"""
    months: int = Field(..., ge=1, le=120, description="续期月数（1~120）")



@router.post("/change-password", response_model=ApiResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(deps.get_current_active_user),
    user_service: UserService = Depends(deps.get_user_service),
) -> ApiResponse:
    """修改当前用户密码"""
    # 验证当前密码
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码不正确")
    
    # 验证新密码长度
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码长度不能少于6位")
    
    # 更新密码
    current_user.password_hash = get_password_hash(payload.new_password)
    await user_service.update(current_user, UserUpdate())
    
    return ApiResponse(success=True, message="密码修改成功")
