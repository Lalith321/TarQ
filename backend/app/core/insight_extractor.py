"""
DocumentInsightExtractor — pulls structured insight out of a document
regardless of whether it arrives as a clean CSV or a messy, unstructured
text dump. Nothing in this pipeline assumes the source has headers, tables,
or any particular layout: everything is reduced to raw text first, then an
LLM extraction pass is asked to find whatever structure exists (or admit
there isn't much), and a merge step tolerates every field being empty.

Pipeline: load() -> chunk() -> extract_chunk() per chunk -> merge().

`extract_fn` is injected (LangChain/LangGraph-style callable: str -> dict)
so this module has no hard dependency on a specific model provider. Without
one, a regex/heuristic fallback keeps the pipeline runnable end-to-end for
testing — it will not find much, but it will not crash on garbage input.
"""
from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path
from typing import Callable, Optional

from app.models.schemas import InsightBundle, ExtractedMetric

ExtractFn = Callable[[str], dict]

EXTRACTION_PROMPT = """You are extracting structured insight from an arbitrary \
document fragment. The document may be a report, a spreadsheet dump, an email \
thread, meeting notes, or something with no consistent structure at all. Do not \
assume any particular schema exists in the source — extract only what is \
actually present.

Return strict JSON with exactly these keys (use empty lists/strings if a \
category has nothing in this fragment):
{{
  "summary": "one or two sentence summary of this fragment",
  "entities": ["people, organizations, products mentioned"],
  "metrics": [{{"label": "...", "value": "...", "unit": "..."}}],
  "action_items": ["explicit or implied next steps"],
  "risks": ["explicit or implied risks/concerns"]
}}

Fragment:
---
{chunk}
---
JSON:"""


def _heuristic_fallback_extract(chunk: str) -> dict:
    """Used only when no extract_fn is injected. Regex-based, low recall by
    design — this exists so the pipeline is runnable without a live model,
    not as a production substitute for one."""
    numbers = re.findall(r"\b\d[\d,]*\.?\d*%?\b", chunk)
    metrics = [{"label": "figure", "value": n, "unit": None} for n in numbers[:5]]
    sentences = re.split(r"(?<=[.!?])\s+", chunk.strip())
    summary = " ".join(sentences[:2])[:280]
    return {
        "summary": summary,
        "entities": [],
        "metrics": metrics,
        "action_items": [],
        "risks": [],
    }


def _safe_json_parse(raw: str) -> Optional[dict]:
    """LLM output isn't always clean JSON. Try straight parse, then try to
    pull the first {...} block out, else give up (caller falls back to
    heuristic extraction for that chunk rather than failing the whole run)."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


class DocumentInsightExtractor:
    def __init__(
        self,
        extract_fn: Optional[ExtractFn] = None,
        chunk_size: int = 3000,
        chunk_overlap: int = 200,
    ):
        self.extract_fn = extract_fn
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    # ── Load: normalize any input format to plain text ──────────────────
    def load(self, path: str) -> str:
        p = Path(path)
        suffix = p.suffix.lower()

        if suffix == ".pdf":
            return self._load_pdf(p)
        if suffix == ".docx":
            return self._load_docx(p)
        if suffix == ".csv":
            return self._load_csv_as_prose(p)

        # .txt, .md, .json, unknown extensions, or no extension: best-effort
        # decode. This is the "non-structural document" path — we never
        # require the file to look like anything in particular.
        try:
            return p.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:  # pragma: no cover - defensive
            return f"[unreadable file, best-effort: {exc}]"

    def _load_pdf(self, p: Path) -> str:
        try:
            from pypdf import PdfReader  # local import: optional dependency
            reader = PdfReader(str(p))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            return f"[pdf extraction failed, falling back to empty text: {exc}]"

    def _load_docx(self, p: Path) -> str:
        try:
            import docx  # python-docx, local import: optional dependency
            d = docx.Document(str(p))
            return "\n".join(para.text for para in d.paragraphs)
        except Exception as exc:
            return f"[docx extraction failed, falling back to empty text: {exc}]"

    def _load_csv_as_prose(self, p: Path) -> str:
        """Even 'structured' CSVs get flattened to prose before extraction —
        this keeps one extraction code path for every input type instead of
        a structured branch and an unstructured branch that drift apart."""
        text = p.read_text(encoding="utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return ""
        header, body = rows[0], rows[1:]
        lines = [", ".join(f"{h}={v}" for h, v in zip(header, row)) for row in body]
        return "\n".join(lines)

    # ── Chunk ────────────────────────────────────────────────────────────
    def chunk(self, text: str) -> list[str]:
        text = text.strip()
        if not text:
            return []
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunks.append(text[start:end])
            start = end - self.chunk_overlap  # overlap avoids splitting a fact in half
            if start <= 0:
                break
        return chunks

    # ── Extract (per chunk) ──────────────────────────────────────────────
    def extract_chunk(self, chunk: str) -> dict:
        if not chunk.strip():
            return _heuristic_fallback_extract("")
        if self.extract_fn is None:
            return _heuristic_fallback_extract(chunk)

        raw = self.extract_fn(EXTRACTION_PROMPT.format(chunk=chunk))
        if isinstance(raw, dict):
            return raw
        parsed = _safe_json_parse(str(raw))
        return parsed if parsed is not None else _heuristic_fallback_extract(chunk)

    # ── Reduce ───────────────────────────────────────────────────────────
    def merge(self, source_file: str, chunk_results: list[dict]) -> InsightBundle:
        entities: set[str] = set()
        metrics: list[ExtractedMetric] = []
        action_items: list[str] = []
        risks: list[str] = []
        summaries: list[str] = []
        low_confidence = self.extract_fn is None

        for r in chunk_results:
            entities.update(r.get("entities") or [])
            for m in r.get("metrics") or []:
                try:
                    metrics.append(ExtractedMetric(**m))
                except Exception:
                    continue  # malformed metric from a bad chunk; skip, don't fail the run
            action_items.extend(r.get("action_items") or [])
            risks.extend(r.get("risks") or [])
            if r.get("summary"):
                summaries.append(r["summary"])

        overall_summary = " ".join(summaries)[:600]

        return InsightBundle(
            source_file=source_file,
            summary=overall_summary,
            entities=sorted(entities),
            metrics=metrics,
            action_items=list(dict.fromkeys(action_items)),  # de-dupe, keep order
            risks=list(dict.fromkeys(risks)),
            chunk_count=len(chunk_results),
            low_confidence=low_confidence,
        )

    # ── Orchestration ────────────────────────────────────────────────────
    def run(self, path: str) -> InsightBundle:
        text = self.load(path)
        chunks = self.chunk(text)
        if not chunks:
            return InsightBundle(source_file=path, low_confidence=True)
        results = [self.extract_chunk(c) for c in chunks]
        return self.merge(path, results)
