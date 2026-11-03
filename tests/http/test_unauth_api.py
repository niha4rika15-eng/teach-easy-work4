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
    ("POST", "/api/export", {"generation_id": GID, "format": "pdf", "diagrams": []}),
    ("GET", "/api/images/search?q=chloroplast", None),
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


def test_export_invalid_params_unauth_is_401_first():
    # Auth is checked before validation since iteration 4.
    r = requests.get(f"{BASE_URL}/api/export?generation_id=bad&format=exe", timeout=30)
    assert r.status_code == 401
    assert "error" in r.json()


# Dashboard bypass closed: proxy redirects protected pages to /login?next=
@pytest.mark.parametrize("cookie", [None, BOGUS], ids=["no-cookie", "bogus-cookie"])
@pytest.mark.parametrize("path", ["/admin", "/admin/users", "/professor", "/professor/generate", "/student", "/student/materials"])
def test_protected_pages_redirect_to_login(path, cookie):
    r = requests.get(f"{BASE_URL}{path}", headers=cookie or {}, allow_redirects=False, timeout=30)
    assert r.status_code == 307
    assert r.headers["location"].endswith(f"/login?next={requests.utils.quote(path, safe='')}")


@pytest.mark.parametrize("path", ["/", "/login", "/signup"])
def test_public_pages_render(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 200
    assert "<html" in r.text.lower()
