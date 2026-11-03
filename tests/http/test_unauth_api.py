# Unauthenticated / bogus-cookie API auth checks for Teach Easy (Next.js on port 3005)
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("TEACH_EASY_URL", "http://localhost:3005").rstrip("/")
BOGUS = {"Cookie": "sb-pctk-auth-token=base64-eyJhIjoxfQ"}
GID = str(uuid.uuid4())

CASES = [
    ("GET", "/api/professor/documents", None),
    ("POST", "/api/professor/documents", None),
    ("DELETE", "/api/professor/documents", {"id": GID}),
    ("POST", "/api/google/forms-create", {"title": "TEST_quiz", "questions": []}),
    ("POST", "/api/generate-and-verify", {"topic": "TEST"}),
    ("GET", f"/api/export?generation_id={GID}&format=pdf", None),
]


@pytest.mark.parametrize("cookie", [None, BOGUS], ids=["no-cookie", "bogus-cookie"])
@pytest.mark.parametrize("method,path,body", CASES, ids=[f"{m} {p.split('?')[0]}" for m, p, _ in CASES])
def test_unauth_returns_json_401(method, path, body, cookie):
    r = requests.request(method, f"{BASE_URL}{path}", json=body, headers=cookie or {}, timeout=30)
    assert r.status_code == 401, f"{r.status_code} {r.text[:200]}"
    assert r.headers.get("content-type", "").startswith("application/json")
    data = r.json()
    assert isinstance(data.get("error"), str) and data["error"]


def test_multipart_upload_unauth_401():
    files = {"file": ("TEST_notes.txt", b"hello world", "text/plain")}
    r = requests.post(f"{BASE_URL}/api/professor/documents", files=files, headers=BOGUS, timeout=30)
    assert r.status_code == 401
    assert "error" in r.json()


def test_export_invalid_params_400():
    r = requests.get(f"{BASE_URL}/api/export?generation_id=bad&format=exe", timeout=30)
    assert r.status_code == 400
    assert "error" in r.json()


@pytest.mark.parametrize("path", ["/", "/login", "/signup"])
def test_public_pages_render(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 200
    assert "<html" in r.text.lower()
