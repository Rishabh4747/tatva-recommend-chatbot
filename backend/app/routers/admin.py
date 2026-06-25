from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_admin
from app.db.database import get_db
from app.db.models import User, UserRole, UserStatus
from app.models.auth import AdminUserResponse, MessageResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _format_date(dt) -> str:
    return dt.strftime("%Y-%m-%d")


def _pending_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        organization=user.organization,
        requested_at=_format_date(user.created_at),
    )


def _approved_user(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        organization=user.organization,
        requested_at=_format_date(user.created_at),
        approved_at=_format_date(user.created_at),
    )


@router.get("/requests/pending", response_model=list[AdminUserResponse])
def list_pending_requests(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.status == UserStatus.pending)
        .order_by(User.created_at.desc())
        .all()
    )
    return [_pending_user(u) for u in users]


@router.get("/requests/approved", response_model=list[AdminUserResponse])
def list_approved_users(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.status == UserStatus.approved, User.role == UserRole.user)
        .order_by(User.created_at.desc())
        .all()
    )
    return [_approved_user(u) for u in users]


def _get_user_or_404(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/requests/{user_id}/approve", response_model=MessageResponse)
def approve_request(
    user_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_or_404(user_id, db)
    if user.status != UserStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be approved.",
        )
    user.status = UserStatus.approved
    db.commit()
    return MessageResponse(message=f"{user.name} has been approved.")


@router.post("/requests/{user_id}/reject", response_model=MessageResponse)
def reject_request(
    user_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_or_404(user_id, db)
    if user.status != UserStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending requests can be rejected.",
        )
    user.status = UserStatus.rejected
    db.commit()
    return MessageResponse(message=f"{user.name}'s request has been rejected.")


@router.post("/users/{user_id}/revoke", response_model=MessageResponse)
def revoke_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_or_404(user_id, db)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot revoke your own access.",
        )
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts cannot be revoked.",
        )
    if user.status != UserStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved users can be revoked.",
        )
    user.status = UserStatus.rejected
    db.commit()
    return MessageResponse(message=f"{user.name}'s access has been revoked.")
