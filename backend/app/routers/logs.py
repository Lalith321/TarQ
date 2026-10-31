from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime, timezone
import logging
import threading

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/logs", tags=["logs"])

_history: deque[dict[str, str]] = deque(maxlen=1000)
_subscribers: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[dict[str, str]]]] = set()
_lock = threading.Lock()


def _enqueue(queue: asyncio.Queue[dict[str, str]], entry: dict[str, str]) -> None:
    if queue.full():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
    queue.put_nowait(entry)


class _BroadcastHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            entry = {
                "type": "log",
                "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": self.format(record),
            }
            with _lock:
                _history.append(entry)
                subscribers = tuple(_subscribers)
            for loop, queue in subscribers:
                try:
                    loop.call_soon_threadsafe(_enqueue, queue, entry)
                except RuntimeError:
                    pass
        except Exception:
            self.handleError(record)


_handler = _BroadcastHandler()
_handler.setLevel(logging.INFO)
_handler.setFormatter(logging.Formatter("%(message)s"))


def _install_handler() -> None:
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)

    root_logger = logging.getLogger()
    if _handler not in root_logger.handlers:
        root_logger.addHandler(_handler)

    for logger_name in ("uvicorn.error", "uvicorn.access"):
        server_logger = logging.getLogger(logger_name)
        if not server_logger.propagate and _handler not in server_logger.handlers:
            server_logger.addHandler(_handler)


_install_handler()


@router.websocket("/ws")
async def stream_application_logs(websocket: WebSocket) -> None:
    await websocket.accept()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, str]] = asyncio.Queue(maxsize=500)
    subscriber = (loop, queue)
    with _lock:
        history = list(_history)
        _subscribers.add(subscriber)

    try:
        for entry in history:
            await websocket.send_json(entry)
        while True:
            try:
                entry = await asyncio.wait_for(queue.get(), timeout=20)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue
            await websocket.send_json(entry)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        with _lock:
            _subscribers.discard(subscriber)