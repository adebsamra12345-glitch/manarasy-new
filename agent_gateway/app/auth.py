import os
import time
from dataclasses import dataclass, field

import jwt
from fastapi import Header, HTTPException

SECRET = os.getenv("AGENT_JWT_SECRET", "dev-only-secret-change-me")
ALGO = "HS256"
ROLES = {"teacher", "manager"}


@dataclass
class Principal:
    user_id: str
    role: str
    tenant_id: str
    halaqat_ids: list = field(default_factory=list)
    forward_headers: dict = field(default_factory=dict)


def make_token(**claims) -> str:
    return jwt.encode(claims, SECRET, algorithm=ALGO)


_ROLE_MAP = (("manager", {"TENANT_ADMIN", "CENTER_MANAGER"}), ("teacher", {"TEACHER"}))
_me_cache: dict = {}   # (token, tenant) -> (exp, Principal)


def _django_principal(authorization: str, tenant_header: str) -> Principal:
    from .backend import BackendError, get_backend
    key = (authorization, tenant_header)
    hit = _me_cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    headers = {"Authorization": authorization}
    if tenant_header:
        headers["Tenant-ID"] = tenant_header
    try:
        me = get_backend().me(headers)
    except BackendError as e:
        raise HTTPException(e.status if e.status in (401, 403, 502) else 401, e.message)
    roles = set(me.get("roles") or [me.get("role")])
    role = next((r for r, names in _ROLE_MAP if roles & names), None)
    if not role:
        raise HTTPException(403, "role not allowed to use the agent")
    p = Principal(str(me.get("id")), role, tenant_header or "", [], headers)
    _me_cache[key] = (time.time() + 60, p)
    return p


def current_principal(authorization: str = Header(default=""),
                      tenant_id: str = Header(default="")) -> Principal:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    if os.getenv("AGENT_BACKEND", "mock") == "django":
        return _django_principal(authorization, tenant_id)
    token = authorization[7:]
    try:
        c = jwt.decode(token, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    if c.get("role") not in ROLES:
        raise HTTPException(403, "role not allowed to use the agent")
    return Principal(c["sub"], c["role"], c["tenant_id"], c.get("halaqat_ids", []))
