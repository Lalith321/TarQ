"""
ContextManager — keeps an agent's working context inside a token budget by
compressing overflow into memory blocks, while keeping structured tool
outputs ("artifacts": dashboard specs, insight bundles, SQL results) in a
separate vault that is never summarized, only referenced by id.

Why a separate vault: naive context compression summarizes *everything* the
same way, which quietly corrupts structured data — a summarizer paraphrasing
a JSON widget spec is a bug, not a feature. Here, artifacts are stored
verbatim and the conversation only ever holds a short reference
("[artifact:dash_9f2] Q3 revenue dashboard, 6 widgets"), so compression only
ever touches free-text turns.

This is intentionally framework-agnostic: `summarize_fn` is injected so this
class has no hard dependency on any specific LLM SDK, and a deterministic
fallback keeps it testable without a live model.
"""
from __future__ import annotations

import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Optional

from app.models.schemas import ConversationTurn, MemoryBlock, ContextSnapshot

SummarizeFn = Callable[[list[ConversationTurn]], str]


def _naive_token_count(text: str) -> int:
    """Whitespace-based estimate (~4 chars/token in English) used when no
    real tokenizer is wired in. Swap for tiktoken in production — see
    LIMITATIONS.md."""
    return max(1, len(text) // 4)


def _extractive_fallback_summarize(turns: list[ConversationTurn]) -> str:
    """Deterministic summarizer used when no LLM callable is provided: takes
    the first sentence of each turn. Good enough for tests/dev; a real
    deployment should inject an LLM-backed summarize_fn instead."""
    bits = []
    for t in turns:
        first_sentence = re.split(r"(?<=[.!?])\s", t.content.strip(), maxsplit=1)[0]
        bits.append(f"{t.role}: {first_sentence[:160]}")
    return "Earlier discussion covered — " + " | ".join(bits)


@dataclass
class Artifact:
    id: str
    kind: str          # "dashboard_spec" | "insight_bundle" | "sql_result" | ...
    payload: dict
    created_at: float = field(default_factory=time.time)

    def reference_line(self) -> str:
        label = self.payload.get("title") or self.payload.get("source_file") or self.kind
        return f"[artifact:{self.id}] {self.kind} — {label}"


class ContextManager:
    def __init__(
        self,
        token_budget: int = 4000,
        keep_recent_turns: int = 6,
        summarize_fn: Optional[SummarizeFn] = None,
        token_counter: Callable[[str], int] = _naive_token_count,
    ):
        self.token_budget = token_budget
        self.keep_recent_turns = keep_recent_turns
        self.summarize_fn = summarize_fn or _extractive_fallback_summarize
        self.token_counter = token_counter

        self.turns: list[ConversationTurn] = []
        self.memory_blocks: list[MemoryBlock] = []
        self.artifacts: dict[str, Artifact] = {}

    # ── Ingestion ────────────────────────────────────────────────────────
    def add_turn(self, role: str, content: str) -> ConversationTurn:
        turn = ConversationTurn(role=role, content=content, tokens=self.token_counter(content))
        self.turns.append(turn)
        self._compress_if_needed()
        return turn

    def add_artifact(self, kind: str, payload: dict) -> str:
        """Store a structured tool output. Returns an id to reference it by —
        callers should add a short turn like
        `ctx.add_turn("tool", ctx.artifacts[aid].reference_line())`
        instead of dumping the whole payload into the conversation."""
        aid = f"{kind[:4]}_{uuid.uuid4().hex[:8]}"
        self.artifacts[aid] = Artifact(id=aid, kind=kind, payload=payload)
        return aid

    # ── Compression ──────────────────────────────────────────────────────
    def _total_tokens(self) -> int:
        return sum(t.tokens for t in self.turns) + sum(m.tokens for m in self.memory_blocks)

    def _compress_if_needed(self) -> None:
        if self._total_tokens() <= self.token_budget:
            return
        if len(self.turns) <= self.keep_recent_turns:
            return  # nothing safe to evict without losing live context

        evictable = self.turns[: -self.keep_recent_turns]
        if not evictable:
            return

        summary_text = self.summarize_fn(evictable)
        summary_tokens = self.token_counter(summary_text)
        self.memory_blocks.append(
            MemoryBlock(summary=summary_text, covers_turns=len(evictable), tokens=summary_tokens)
        )
        self.turns = self.turns[-self.keep_recent_turns :]

        # If still over budget (pathological single huge turn), drop oldest
        # memory blocks first — they're already lossy, losing an old summary
        # is cheaper than truncating live conversation.
        while self._total_tokens() > self.token_budget and len(self.memory_blocks) > 1:
            self.memory_blocks.pop(0)

    # ── Retrieval ────────────────────────────────────────────────────────
    def _score_block(self, block: MemoryBlock, query: str) -> int:
        """Keyword overlap scoring. A real deployment should back this with
        an embedding store (pgvector/Weaviate, matching the RAG stack used
        elsewhere) — see LIMITATIONS.md."""
        q_terms = set(re.findall(r"\w+", query.lower()))
        b_terms = set(re.findall(r"\w+", block.summary.lower()))
        return len(q_terms & b_terms)

    def build_context(self, query: str, max_memory_blocks: int = 3) -> ContextSnapshot:
        """Assemble what the agent should actually see for this turn: the
        live (uncompressed) recent turns, plus the top-scoring memory blocks
        for this query, plus reference lines for any artifact mentioned in
        included turns (never the full artifact payload)."""
        ranked = sorted(self.memory_blocks, key=lambda b: self._score_block(b, query), reverse=True)
        chosen_blocks = [b for b in ranked[:max_memory_blocks] if self._score_block(b, query) > 0]

        messages: list[dict[str, str]] = []
        for b in chosen_blocks:
            messages.append({"role": "system", "content": f"[compressed memory] {b.summary}"})
        for t in self.turns:
            messages.append({"role": t.role, "content": t.content})

        referenced = [
            aid for aid, art in self.artifacts.items()
            if any(art.reference_line() in m["content"] for m in messages)
        ]

        est_tokens = sum(self.token_counter(m["content"]) for m in messages)
        return ContextSnapshot(
            messages=messages,
            memory_blocks_used=len(chosen_blocks),
            artifacts_referenced=referenced,
            estimated_tokens=est_tokens,
        )
