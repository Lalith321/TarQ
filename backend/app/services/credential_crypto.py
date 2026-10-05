"""Authenticated encryption for saved database credentials."""

from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

from app.db.database import DATABASE_URL


def _cipher() -> Fernet:
    secret = os.getenv("CREDENTIAL_ENCRYPTION_KEY") or DATABASE_URL
    if not secret:
        raise RuntimeError(
            "Set CREDENTIAL_ENCRYPTION_KEY to keep saved database credentials readable across restarts"
        )
    key_material = hashlib.sha256(
        b"tarq-schema-credentials:" + secret.encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_credential(password: str) -> str:
    return _cipher().encrypt(password.encode("utf-8")).decode("ascii")


def decrypt_credential(encrypted_password: str) -> str | None:
    try:
        return _cipher().decrypt(encrypted_password.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return None