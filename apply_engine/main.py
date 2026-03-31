from __future__ import annotations

import os
import tempfile

try:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
except ImportError:  # pragma: no cover
    FastAPI = None  # type: ignore[assignment]
    JSONResponse = None  # type: ignore[assignment]

try:
    import httpx as _httpx
except ImportError:  # pragma: no cover
    _httpx = None  # type: ignore[assignment]

from apply_engine.models import ApplicantProfile, ApplyRequest
from apply_engine.schemas import ApplyPayload, ApplyResultPayload, SchemaValidationError
from apply_engine.registry import route_application
from apply_engine.serialize import serialize_apply_result


def _resolve_resume_path(resume_pdf_path: str) -> str:
    """If resume_pdf_path is an HTTP URL, download it to a temp file and return the local path."""
    if not resume_pdf_path or not resume_pdf_path.startswith("http"):
        return resume_pdf_path

    if _httpx is None:
        return resume_pdf_path  # can't download without httpx

    try:
        response = _httpx.get(resume_pdf_path, timeout=30, follow_redirects=True)
        response.raise_for_status()
        suffix = ".pdf"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="twin_resume_")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(response.content)
        except Exception:
            os.close(fd)
            raise
        return tmp_path
    except Exception as exc:
        print(f"[apply_engine] Failed to download resume from URL: {exc}")
        return ""


def create_app() -> FastAPI:
    if FastAPI is None:  # pragma: no cover
        raise RuntimeError("fastapi is not installed. Install apply_engine/requirements.txt first.")

    app = FastAPI(title="Twin Apply Engine")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/plan")
    async def plan(payload: dict[str, object]) -> dict[str, object]:
        try:
            parsed = ApplyPayload.from_dict(payload)
        except SchemaValidationError as exc:
            return JSONResponse(status_code=422, content={"error": str(exc)})

        profile = ApplicantProfile(**parsed.profile.to_dict())
        request = ApplyRequest(
            url=parsed.url,
            profile=profile,
            dry_run=True,
            runtime_hints=parsed.runtime_hints or {},
        )
        result = await route_application(request)
        return serialize_apply_result(result).to_dict()

    @app.post("/apply")
    async def apply(payload: dict[str, object]) -> dict[str, object]:
        try:
            parsed = ApplyPayload.from_dict(payload)
        except SchemaValidationError as exc:
            return JSONResponse(status_code=422, content={"error": str(exc)})

        profile_dict = parsed.profile.to_dict()
        profile_dict["resume_pdf_path"] = _resolve_resume_path(
            profile_dict.get("resume_pdf_path", "")
        )
        profile = ApplicantProfile(**profile_dict)
        request = ApplyRequest(
            url=parsed.url,
            profile=profile,
            dry_run=parsed.dry_run,
            runtime_hints=parsed.runtime_hints or {},
        )
        result = await route_application(request)
        return serialize_apply_result(result).to_dict()

    return app


app = create_app() if FastAPI is not None else None
