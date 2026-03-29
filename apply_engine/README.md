# Twin Apply Engine

This service is the low-cost autonomous apply runner.

## Build order

1. `detector.py`
2. `greenhouse.py`
3. `lever.py`
4. `vision.py`
5. `main.py` queue endpoint

## Local setup

1. Create a Python virtual environment.
2. Install dependencies from `requirements.txt`.
3. Run detector tests first.
4. Add Playwright browsers.
5. Start the FastAPI app.

## Commands

```bash
python3 -m unittest discover apply_engine/tests -v
python3 -m py_compile $(find apply_engine -name '*.py')
```

If you install the runtime dependencies:

```bash
pip install -r apply_engine/requirements.txt
playwright install chromium
uvicorn apply_engine.main:app --reload
```

## Endpoints

- `GET /health`
- `POST /plan`
- `POST /apply`

Use `/plan` first during development. It returns the detected portal and the exact action plan without attempting submission.
