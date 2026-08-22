from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_quick_dashboard_route_exists():
    response = client.post("/agent/quick-dashboard", json={"prompt": "Revenue by region"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"].startswith("quick_")
    assert body["title"]


def test_dashboard_chat_route_exists():
    response = client.post(
        "/agent/dashboard-chat",
        json={"sessionId": "s1", "message": "Build a chart", "context": {"dashboardId": "demo"}},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "reply" in body
