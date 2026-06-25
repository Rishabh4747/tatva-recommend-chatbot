import logging

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config.settings import settings
from app.db.models import User, UserRole, UserStatus

logger = logging.getLogger(__name__)


def seed_admin_user(db: Session) -> None:
    existing_admin = db.query(User).filter(User.role == UserRole.admin).first()
    if existing_admin:
        return

    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.warning(
            "No admin user exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set — skipping admin seed."
        )
        return

    email = settings.ADMIN_EMAIL.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.role = UserRole.admin
        existing.status = UserStatus.approved
        db.commit()
        logger.info("Promoted existing user %s to admin.", email)
        return

    admin = User(
        name="Admin",
        email=email,
        organization="CarbonTatva",
        hashed_password=hash_password(settings.ADMIN_PASSWORD),
        role=UserRole.admin,
        status=UserStatus.approved,
    )
    db.add(admin)
    db.commit()
    logger.info("Seeded admin user: %s", email)
