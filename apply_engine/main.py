from __future__ import annotations

try:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
except ImportError:  # pragma: no cover
    FastAPI = None  # type: ignore[assignment]
    JSONResponse = None  # type: ignore[assignment]

from apply_engine.models import ApplicantProfile, ApplyRequest
from apply_engine.schemas import ApplyPayload, ApplyResultPayload, SchemaValidationError
from apply_engine.registry import route_application
from apply_engine.serialize import serialize_apply_result


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
        )
        result = await route_application(request)
        return serialize_apply_result(result).to_dict()

    @app.post("/apply")
    async def apply(payload: dict[str, object]) -> dict[str, object]:
        try:
            parsed = ApplyPayload.from_dict(payload)
        except SchemaValidationError as exc:
            return JSONResponse(status_code=422, content={"error": str(exc)})

        profile = ApplicantProfile(**parsed.profile.to_dict())
        request = ApplyRequest(
            url=parsed.url,
            profile=profile,
            dry_run=parsed.dry_run,
        )
        result = await route_application(request)
        return serialize_apply_result(result).to_dict()

    return app


app = create_app() if FastAPI is not None else None
