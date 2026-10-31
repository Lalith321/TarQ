"""
Executive PDF Report Generator for TarQ Dashboards.

Produces a multi-page, vector-graphic PDF 1.4 analytical report for a
single dashboard, including:
- Executive cover header & metadata summary
- KPI highlight cards
- Vector chart visualizations (bar, line/multi-line/area, pie, GIS, stat)
- Automated statistical summary per widget (count, total, mean, min, max, top item)
- Structured data tables
- Dashboard-scoped outputs/media inventory
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.schemas import DashboardSpec, WidgetSpec


PAGE_W = 595.28  # A4 width in points
PAGE_H = 841.89  # A4 height in points
MARGIN_X = 40.0
TOP_Y = PAGE_H - 45.0
BOTTOM_Y = 48.0
CONTENT_W = PAGE_W - 2 * MARGIN_X

PALETTE: list[tuple[float, float, float]] = [
    (0.231, 0.510, 0.965),  # #3b82f6 blue
    (0.024, 0.714, 0.831),  # #06b6d4 cyan
    (0.063, 0.725, 0.506),  # #10b981 emerald
    (0.545, 0.361, 0.965),  # #8b5cf6 violet
    (0.961, 0.620, 0.043),  # #f59e0b amber
    (0.937, 0.267, 0.267),  # #ef4444 red
    (0.925, 0.282, 0.600),  # #ec4899 pink
]


def _pdf_escape(text: str) -> str:
    """Sanitize and escape text for PDF literal strings."""
    cleaned = (
        str(text)
        .replace("\r", " ")
        .replace("\n", " ")
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2022", "*")
        .replace("\u00b7", "|")
        .replace("\u20b9", "INR ")
    )
    ascii_text = cleaned.encode("latin-1", errors="replace").decode("latin-1")
    return (
        ascii_text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _format_num(val: Any) -> str:
    if val is None or isinstance(val, bool):
        return "-" if val is None else str(val)
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return "-"
        abs_v = abs(val)
        if abs_v >= 1_000_000_000:
            return f"{val / 1_000_000_000:,.2f}B"
        if abs_v >= 1_000_000:
            return f"{val / 1_000_000:,.2f}M"
        if abs_v >= 10_000:
            return f"{val:,.0f}"
        if isinstance(val, int) or val == int(val):
            return f"{int(val):,}"
        return f"{val:,.2f}"
    # Try parsing numeric strings
    s = str(val).strip()
    try:
        num = float(s.replace(",", ""))
        return _format_num(num)
    except ValueError:
        return s


def _to_float(val: Any) -> float | None:
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    try:
        return float(str(val).replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def _wrap_text(text: str, max_chars: int) -> list[str]:
    words = str(text or "").split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        if len(current) + 1 + len(word) <= max_chars:
            current += " " + word
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class _PdfCanvas:
    """Multi-page PDF 1.4 vector canvas."""

    def __init__(self, dashboard_title: str) -> None:
        self.dashboard_title = dashboard_title
        self.pages: list[list[str]] = [[]]
        self.y = TOP_Y

    @property
    def stream(self) -> list[str]:
        return self.pages[-1]

    def new_page(self) -> None:
        self.pages.append([])
        self.y = TOP_Y
        # Subtle top header bar on continuation pages
        self.rect(MARGIN_X, PAGE_H - 36, CONTENT_W, 0.75, fill=(0.82, 0.85, 0.90))
        self.text(
            MARGIN_X,
            PAGE_H - 30,
            f"TarQ Dashboard Report | {self.dashboard_title}",
            size=8,
            color=(0.45, 0.50, 0.58),
        )
        self.y = PAGE_H - 54

    def ensure_space(self, height_needed: float) -> None:
        if self.y - height_needed < BOTTOM_Y:
            self.new_page()

    def rect(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        *,
        fill: tuple[float, float, float] | None = None,
        stroke: tuple[float, float, float] | None = None,
        line_width: float = 1.0,
    ) -> None:
        ops: list[str] = ["q"]
        if fill is not None:
            ops.append(f"{fill[0]:.3f} {fill[1]:.3f} {fill[2]:.3f} rg")
        if stroke is not None:
            ops.append(f"{stroke[0]:.3f} {stroke[1]:.3f} {stroke[2]:.3f} RG")
            ops.append(f"{line_width:.2f} w")
        paint = "B" if (fill and stroke) else ("f" if fill else "S")
        ops.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re {paint}")
        ops.append("Q")
        self.stream.append("\n".join(ops))

    def line(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        *,
        color: tuple[float, float, float] = (0.85, 0.88, 0.92),
        width: float = 1.0,
    ) -> None:
        self.stream.append(
            f"q {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG {width:.2f} w "
            f"{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S Q"
        )

    def polyline(
        self,
        points: list[tuple[float, float]],
        *,
        color: tuple[float, float, float],
        width: float = 1.8,
    ) -> None:
        if len(points) < 2:
            return
        coords = [f"{points[0][0]:.2f} {points[0][1]:.2f} m"]
        for px, py in points[1:]:
            coords.append(f"{px:.2f} {py:.2f} l")
        self.stream.append(
            f"q {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG {width:.2f} w "
            + " ".join(coords)
            + " S Q"
        )

    def circle_dot(
        self,
        cx: float,
        cy: float,
        r: float,
        *,
        fill: tuple[float, float, float],
    ) -> None:
        self.rect(cx - r, cy - r, r * 2, r * 2, fill=fill)

    def text(
        self,
        x: float,
        y: float,
        value: str,
        *,
        size: float = 10.0,
        bold: bool = False,
        color: tuple[float, float, float] = (0.10, 0.14, 0.20),
        max_chars: int | None = None,
    ) -> None:
        content = str(value or "")
        if max_chars is not None and len(content) > max_chars:
            content = content[: max(1, max_chars - 1)] + "..."
        font_ref = "/F2" if bold else "/F1"
        escaped = _pdf_escape(content)
        self.stream.append(
            f"q BT {font_ref} {size:.1f} Tf "
            f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg "
            f"{x:.2f} {y:.2f} Td ({escaped}) Tj ET Q"
        )

    def finalize_bytes(self) -> bytes:
        total_pages = len(self.pages)
        for idx, page_ops in enumerate(self.pages, start=1):
            # Footer on each page
            page_ops.append(
                f"q 0.850 0.880 0.920 RG 0.75 w "
                f"{MARGIN_X:.2f} 34.00 m {PAGE_W - MARGIN_X:.2f} 34.00 l S Q"
            )
            left_footer = _pdf_escape(f"TarQ Analytics Platform | {self.dashboard_title}")
            right_footer = _pdf_escape(f"Page {idx} of {total_pages}")
            page_ops.append(
                f"q BT /F1 8.0 Tf 0.450 0.500 0.580 rg {MARGIN_X:.2f} 22.00 Td ({left_footer}) Tj ET Q"
            )
            page_ops.append(
                f"q BT /F1 8.0 Tf 0.450 0.500 0.580 rg {PAGE_W - MARGIN_X - 55:.2f} 22.00 Td ({right_footer}) Tj ET Q"
            )

        # Object layout:
        # 1: Catalog
        # 2: Pages
        # 3: Font F1 (Helvetica)
        # 4: Font F2 (Helvetica-Bold)
        # For each page i (0..N-1):
        #   page_obj_id = 5 + 2*i
        #   content_obj_id = 6 + 2*i
        objects: list[bytes] = []

        def add_obj(body: bytes) -> int:
            objects.append(body)
            return len(objects)

        add_obj(b"<< /Type /Catalog /Pages 2 0 R >>")
        add_obj(b"")  # placeholder for Pages
        add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

        page_obj_ids: list[int] = []
        for page_ops in self.pages:
            stream_bytes = "\n".join(page_ops).encode("latin-1", errors="replace")
            page_id = len(objects) + 1
            content_id = page_id + 1
            page_obj_ids.append(page_id)
            page_dict = (
                f"<< /Type /Page /Parent 2 0 R "
                f"/MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode("ascii")
            add_obj(page_dict)
            content_dict = (
                f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii")
                + stream_bytes
                + b"\nendstream"
            )
            add_obj(content_dict)

        kids_refs = " ".join(f"{pid} 0 R" for pid in page_obj_ids)
        objects[1] = f"<< /Type /Pages /Kids [{kids_refs}] /Count {len(page_obj_ids)} >>".encode("ascii")

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: list[int] = [0]
        for obj_num, obj_body in enumerate(objects, start=1):
            offsets.append(len(out))
            out.extend(f"{obj_num} 0 obj\n".encode("ascii"))
            out.extend(obj_body)
            out.extend(b"\nendobj\n")

        xref_offset = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii")
        )
        return bytes(out)


def _infer_fields(widget: WidgetSpec) -> tuple[str | None, list[str]]:
    rows = widget.data or []
    sample = rows[0] if rows else {}
    keys = list(sample.keys())

    x_field = getattr(widget, "x_field", None) or getattr(widget, "x_axis", None) or getattr(widget, "x_key", None)
    if not x_field and keys:
        x_field = keys[0]

    raw_y = getattr(widget, "y_field", None) or getattr(widget, "y_axis", None) or getattr(widget, "y_key", None)
    group_by = getattr(widget, "group_by", None)
    y_fields: list[str] = []
    if isinstance(raw_y, list):
        y_fields = [str(f) for f in raw_y if f]
    elif isinstance(raw_y, str) and raw_y:
        y_fields = [raw_y]

    if not y_fields and keys:
        for k in keys:
            if k == x_field or k == group_by:
                continue
            if any(_to_float(r.get(k)) is not None for r in rows[:10]):
                y_fields.append(k)
        if not y_fields and len(keys) > 1:
            y_fields = [keys[1]]
        elif not y_fields and keys:
            y_fields = [keys[0]]

    return x_field, y_fields



def _compute_widget_stats(widget: WidgetSpec) -> dict[str, str]:
    rows = widget.data or []
    if not rows:
        return {"rows": "0"}

    x_field, y_fields = _infer_fields(widget)
    stats: dict[str, str] = {"rows": f"{len(rows):,}"}
    if not y_fields:
        return stats

    primary_y = y_fields[0]
    numeric_pairs: list[tuple[str, float]] = []
    for row in rows:
        val = _to_float(row.get(primary_y))
        if val is not None:
            label = str(row.get(x_field, "")) if x_field else ""
            numeric_pairs.append((label, val))

    if not numeric_pairs:
        return stats

    values = [v for _, v in numeric_pairs]
    total = sum(values)
    avg = total / len(values)
    max_label, max_val = max(numeric_pairs, key=lambda item: item[1])
    min_label, min_val = min(numeric_pairs, key=lambda item: item[1])

    stats["metric"] = primary_y
    stats["total"] = _format_num(total)
    stats["avg"] = _format_num(avg)
    stats["max"] = f"{_format_num(max_val)}" + (f" ({max_label})" if max_label else "")
    stats["min"] = f"{_format_num(min_val)}" + (f" ({min_label})" if min_label else "")
    return stats


def _draw_bar_chart(canvas: _PdfCanvas, widget: WidgetSpec, x: float, y_top: float, w: float, h: float) -> None:
    rows = (widget.data or [])[:12]
    x_field, y_fields = _infer_fields(widget)
    if not rows or not y_fields:
        return

    canvas.rect(x, y_top - h, w, h, fill=(0.975, 0.980, 0.990), stroke=(0.88, 0.90, 0.94), line_width=0.75)

    pad_left = 48.0
    pad_right = 16.0
    pad_top = 18.0
    pad_bottom = 26.0
    plot_x = x + pad_left
    plot_y = y_top - h + pad_bottom
    plot_w = w - pad_left - pad_right
    plot_h = h - pad_top - pad_bottom

    # Collect numeric values across y_fields
    series_keys = y_fields[:3]
    all_vals: list[float] = []
    for r in rows:
        for sk in series_keys:
            v = _to_float(r.get(sk))
            if v is not None:
                all_vals.append(max(0.0, v))
    max_val = max(all_vals) if all_vals and max(all_vals) > 0 else 1.0

    # Grid lines
    for step in range(5):
        frac = step / 4.0
        gy = plot_y + frac * plot_h
        canvas.line(plot_x, gy, plot_x + plot_w, gy, color=(0.89, 0.91, 0.95), width=0.5)
        canvas.text(x + 6, gy - 3, _format_num(max_val * frac), size=6.5, color=(0.45, 0.50, 0.58), max_chars=9)

    n_groups = len(rows)
    n_series = len(series_keys)
    group_w = plot_w / max(1, n_groups)
    bar_w = min(28.0, (group_w * 0.72) / max(1, n_series))

    for i, row in enumerate(rows):
        gx = plot_x + i * group_w + (group_w - bar_w * n_series) / 2.0
        for s_idx, sk in enumerate(series_keys):
            val = max(0.0, _to_float(row.get(sk)) or 0.0)
            bh = max(1.5, (val / max_val) * plot_h) if val > 0 else 0.0
            bx = gx + s_idx * bar_w
            color = PALETTE[s_idx % len(PALETTE)]
            if bh > 0:
                canvas.rect(bx, plot_y, max(2.0, bar_w - 1.5), bh, fill=color)
        label = str(row.get(x_field, i + 1)) if x_field else str(i + 1)
        canvas.text(
            plot_x + i * group_w + 2,
            plot_y - 12,
            label,
            size=6.5,
            color=(0.30, 0.35, 0.43),
            max_chars=max(4, int(group_w / 4.2)),
        )

    # Legend if multiple series
    if n_series > 1:
        lx = plot_x
        for s_idx, sk in enumerate(series_keys):
            color = PALETTE[s_idx % len(PALETTE)]
            canvas.rect(lx, y_top - 12, 7, 7, fill=color)
            canvas.text(lx + 10, y_top - 11, sk, size=7.0, bold=True, color=(0.25, 0.30, 0.38), max_chars=22)
            lx += 110


def _draw_line_chart(canvas: _PdfCanvas, widget: WidgetSpec, x: float, y_top: float, w: float, h: float) -> None:
    rows = widget.data or []
    x_field, y_fields = _infer_fields(widget)
    if not rows or not y_fields:
        return

    canvas.rect(x, y_top - h, w, h, fill=(0.975, 0.980, 0.990), stroke=(0.88, 0.90, 0.94), line_width=0.75)

    pad_left = 48.0
    pad_right = 16.0
    pad_top = 20.0
    pad_bottom = 26.0
    plot_x = x + pad_left
    plot_y = y_top - h + pad_bottom
    plot_w = w - pad_left - pad_right
    plot_h = h - pad_top - pad_bottom

    # Build series (either grouped by group_by or multiple y_fields)
    x_labels: list[str] = []
    series_map: dict[str, dict[str, float]] = {}

    group_by = getattr(widget, "group_by", None)
    if group_by and x_field:
        primary_y = y_fields[0]
        for r in rows:
            xl = str(r.get(x_field, ""))
            grp = str(r.get(group_by, "Series"))
            val = _to_float(r.get(primary_y))
            if xl not in x_labels:
                x_labels.append(xl)
            if val is not None:
                series_map.setdefault(grp, {})[xl] = val
    else:
        for idx, r in enumerate(rows[:20]):
            xl = str(r.get(x_field, idx + 1)) if x_field else str(idx + 1)
            if xl not in x_labels:
                x_labels.append(xl)
            for sk in y_fields[:4]:
                val = _to_float(r.get(sk))
                if val is not None:
                    series_map.setdefault(sk, {})[xl] = val

    # Limit to top 5 series by max value so legend/plot stays clean
    ranked_series = sorted(
        series_map.items(),
        key=lambda item: max(item[1].values()) if item[1] else 0.0,
        reverse=True,
    )[:5]

    all_vals = [v for _, pts in ranked_series for v in pts.values()]
    max_val = max(all_vals) if all_vals and max(all_vals) > 0 else 1.0
    min_val = min(0.0, min(all_vals)) if all_vals else 0.0
    span = max(1e-6, max_val - min_val)

    for step in range(5):
        frac = step / 4.0
        gy = plot_y + frac * plot_h
        canvas.line(plot_x, gy, plot_x + plot_w, gy, color=(0.89, 0.91, 0.95), width=0.5)
        canvas.text(x + 6, gy - 3, _format_num(min_val + span * frac), size=6.5, color=(0.45, 0.50, 0.58), max_chars=9)

    n_x = len(x_labels)
    for i, xl in enumerate(x_labels):
        px = plot_x + (i / max(1, n_x - 1)) * plot_w if n_x > 1 else plot_x + plot_w / 2.0
        if n_x <= 10 or i % max(1, n_x // 8) == 0:
            canvas.text(px - 10, plot_y - 12, xl, size=6.5, color=(0.30, 0.35, 0.43), max_chars=10)

    for s_idx, (s_name, pts_dict) in enumerate(ranked_series):
        color = PALETTE[s_idx % len(PALETTE)]
        pts: list[tuple[float, float]] = []
        for i, xl in enumerate(x_labels):
            if xl not in pts_dict:
                continue
            px = plot_x + (i / max(1, n_x - 1)) * plot_w if n_x > 1 else plot_x + plot_w / 2.0
            py = plot_y + ((pts_dict[xl] - min_val) / span) * plot_h
            pts.append((px, py))
        canvas.polyline(pts, color=color, width=1.8)
        for px, py in pts:
            canvas.circle_dot(px, py, 2.0, fill=color)

    # Legend
    lx = plot_x
    for s_idx, (s_name, _) in enumerate(ranked_series):
        color = PALETTE[s_idx % len(PALETTE)]
        canvas.rect(lx, y_top - 13, 7, 7, fill=color)
        canvas.text(lx + 9, y_top - 12, s_name, size=6.5, bold=True, color=(0.25, 0.30, 0.38), max_chars=16)
        lx += min(92.0, plot_w / max(1, len(ranked_series)))


def _draw_pie_distribution(canvas: _PdfCanvas, widget: WidgetSpec, x: float, y_top: float, w: float, h: float) -> None:
    rows = (widget.data or [])[:8]
    x_field, y_fields = _infer_fields(widget)
    if not rows or not y_fields:
        return

    canvas.rect(x, y_top - h, w, h, fill=(0.975, 0.980, 0.990), stroke=(0.88, 0.90, 0.94), line_width=0.75)
    primary_y = y_fields[0]
    slices: list[tuple[str, float]] = []
    for idx, r in enumerate(rows):
        val = max(0.0, _to_float(r.get(primary_y)) or 0.0)
        if val > 0:
            label = str(r.get(x_field, f"Slice {idx + 1}")) if x_field else f"Slice {idx + 1}"
            slices.append((label, val))

    total = sum(v for _, v in slices) or 1.0
    bar_x = x + 16.0
    bar_y = y_top - 36.0
    bar_w = w - 32.0
    bar_h = 18.0

    cursor_x = bar_x
    for idx, (_, val) in enumerate(slices):
        seg_w = (val / total) * bar_w
        canvas.rect(cursor_x, bar_y, max(1.0, seg_w), bar_h, fill=PALETTE[idx % len(PALETTE)])
        cursor_x += seg_w

    # Legend items below stacked proportional bar
    ly = bar_y - 18.0
    for idx, (label, val) in enumerate(slices):
        col = idx % 2
        row_idx = idx // 2
        ix = bar_x + col * (bar_w / 2.0)
        iy = ly - row_idx * 14.0
        if iy < y_top - h + 8:
            break
        pct = (val / total) * 100.0
        canvas.rect(ix, iy, 7, 7, fill=PALETTE[idx % len(PALETTE)])
        canvas.text(
            ix + 11,
            iy,
            f"{label}: {_format_num(val)} ({pct:.1f}%)",
            size=7.5,
            color=(0.20, 0.25, 0.33),
            max_chars=36,
        )


def _draw_table(canvas: _PdfCanvas, rows: list[dict[str, Any]], max_rows: int = 12) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())[:6]
    if not columns:
        return

    row_h = 15.0
    display_rows = rows[:max_rows]
    needed_h = (len(display_rows) + 2) * row_h + 8.0
    canvas.ensure_space(min(needed_h, 220.0))

    col_w = CONTENT_W / len(columns)
    max_chars = max(8, int(col_w / 4.8))

    # Header row
    canvas.rect(MARGIN_X, canvas.y - row_h, CONTENT_W, row_h, fill=(0.12, 0.16, 0.24))
    for c_idx, col_name in enumerate(columns):
        canvas.text(
            MARGIN_X + c_idx * col_w + 5.0,
            canvas.y - row_h + 4.5,
            str(col_name),
            size=7.5,
            bold=True,
            color=(0.95, 0.97, 1.0),
            max_chars=max_chars,
        )
    canvas.y -= row_h

    for r_idx, row in enumerate(display_rows):
        if canvas.y - row_h < BOTTOM_Y:
            canvas.new_page()
            canvas.rect(MARGIN_X, canvas.y - row_h, CONTENT_W, row_h, fill=(0.12, 0.16, 0.24))
            for c_idx, col_name in enumerate(columns):
                canvas.text(
                    MARGIN_X + c_idx * col_w + 5.0,
                    canvas.y - row_h + 4.5,
                    str(col_name),
                    size=7.5,
                    bold=True,
                    color=(0.95, 0.97, 1.0),
                    max_chars=max_chars,
                )
            canvas.y -= row_h

        bg = (0.965, 0.973, 0.985) if r_idx % 2 == 0 else (1.0, 1.0, 1.0)
        canvas.rect(MARGIN_X, canvas.y - row_h, CONTENT_W, row_h, fill=bg, stroke=(0.90, 0.92, 0.95), line_width=0.4)
        for c_idx, col_name in enumerate(columns):
            raw_val = row.get(col_name, "")
            formatted = _format_num(raw_val) if isinstance(raw_val, (int, float)) else ("" if raw_val is None else str(raw_val))
            canvas.text(
                MARGIN_X + c_idx * col_w + 5.0,
                canvas.y - row_h + 4.5,
                formatted,
                size=7.5,
                color=(0.18, 0.22, 0.30),
                max_chars=max_chars,
            )
        canvas.y -= row_h

    if len(rows) > max_rows:
        canvas.y -= 11
        canvas.text(
            MARGIN_X + 2,
            canvas.y,
            f"Showing {max_rows} of {len(rows):,} rows in report.",
            size=7.0,
            color=(0.45, 0.50, 0.58),
        )
    canvas.y -= 10


def generate_dashboard_report_pdf(
    dashboard: DashboardSpec,
    outputs: list[dict[str, Any]] | None = None,
    *,
    artifacts: list[dict[str, Any]] | None = None,
) -> bytes:
    """Render a complete multi-page executive PDF report for ``dashboard``."""
    title = (dashboard.title or "Untitled Dashboard").strip()
    canvas = _PdfCanvas(title)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    widgets = dashboard.widgets or []
    outputs = outputs if outputs is not None else (artifacts or [])

    # ── 1. Executive Cover Banner ───────────────────────────────────────────
    banner_h = 86.0
    canvas.rect(MARGIN_X, canvas.y - banner_h, CONTENT_W, banner_h, fill=(0.06, 0.09, 0.16))
    canvas.rect(MARGIN_X, canvas.y - 4.0, CONTENT_W, 4.0, fill=(0.23, 0.51, 0.96))

    canvas.text(
        MARGIN_X + 16,
        canvas.y - 20,
        "TARQ ANALYTICS  |  EXECUTIVE DASHBOARD REPORT",
        size=8.0,
        bold=True,
        color=(0.23, 0.68, 0.96),
    )
    canvas.text(
        MARGIN_X + 16,
        canvas.y - 40,
        title,
        size=16.0,
        bold=True,
        color=(0.98, 0.99, 1.0),
        max_chars=58,
    )
    subtitle = (getattr(dashboard, "description", "") or "Comprehensive analytics breakdown, visualizations, and verified widget data.").strip()
    canvas.text(
        MARGIN_X + 16,
        canvas.y - 56,
        subtitle,
        size=8.5,
        color=(0.72, 0.78, 0.86),
        max_chars=88,
    )
    meta_line = (
        f"Dashboard ID: {dashboard.id}   |   Generated: {now_str}   |   "
        f"Widgets: {len(widgets)}   |   Attached Outputs: {len(outputs)}"
    )
    canvas.text(
        MARGIN_X + 16,
        canvas.y - 74,
        meta_line,
        size=7.5,
        color=(0.56, 0.64, 0.74),
        max_chars=98,
    )
    canvas.y -= banner_h + 16.0

    # ── 2. Executive Summary & KPI Cards ────────────────────────────────────
    stat_widgets = [w for w in widgets if str(getattr(w.type, "value", w.type)).lower() in {"stat", "kpi"}]
    total_rows = sum(len(w.data or []) for w in widgets)

    canvas.text(MARGIN_X, canvas.y, "EXECUTIVE SUMMARY", size=9.5, bold=True, color=(0.15, 0.23, 0.38))
    canvas.y -= 8.0
    canvas.line(MARGIN_X, canvas.y, MARGIN_X + CONTENT_W, canvas.y, color=(0.82, 0.86, 0.92), width=0.8)
    canvas.y -= 10.0

    kpi_cards: list[tuple[str, str, str]] = [
        ("Total Widgets", str(len(widgets)), "Active visual modules"),
        ("Data Points Analyzed", f"{total_rows:,}", "Materialized rows across widgets"),
        ("Linked Outputs", str(len(outputs)), "Videos, decks & artifacts"),
    ]
    for sw in stat_widgets[:3]:
        row0 = (sw.data or [{}])[0] if sw.data else {}
        _, yf = _infer_fields(sw)
        val_key = yf[0] if yf else (next(iter(row0.keys()), None))
        raw_v = row0.get(val_key, "-") if val_key else "-"
        kpi_cards.append((sw.title, _format_num(raw_v), "KPI Metric"))

    kpi_cards = kpi_cards[:4]
    card_gap = 10.0
    card_w = (CONTENT_W - card_gap * (len(kpi_cards) - 1)) / len(kpi_cards)
    card_h = 48.0
    for idx, (k_label, k_val, k_sub) in enumerate(kpi_cards):
        cx = MARGIN_X + idx * (card_w + card_gap)
        canvas.rect(cx, canvas.y - card_h, card_w, card_h, fill=(0.96, 0.97, 0.99), stroke=(0.85, 0.89, 0.95), line_width=0.8)
        canvas.rect(cx, canvas.y - 3.0, card_w, 3.0, fill=PALETTE[idx % len(PALETTE)])
        canvas.text(cx + 8, canvas.y - 15, k_label.upper(), size=6.5, bold=True, color=(0.42, 0.48, 0.58), max_chars=24)
        canvas.text(cx + 8, canvas.y - 31, str(k_val), size=12.5, bold=True, color=(0.08, 0.12, 0.20), max_chars=18)
        canvas.text(cx + 8, canvas.y - 42, k_sub, size=6.5, color=(0.48, 0.54, 0.64), max_chars=26)
    canvas.y -= card_h + 18.0

    # ── 3. Detailed Widget Sections ─────────────────────────────────────────
    if not widgets:
        canvas.rect(MARGIN_X, canvas.y - 44, CONTENT_W, 44, fill=(0.97, 0.98, 0.99), stroke=(0.88, 0.90, 0.94))
        canvas.text(MARGIN_X + 14, canvas.y - 25, "No widgets have been added to this dashboard yet.", size=9.5, color=(0.40, 0.45, 0.54))
        canvas.y -= 58
    else:
        for w_idx, widget in enumerate(widgets, start=1):
            w_type_str = str(getattr(widget.type, "value", widget.type)).lower()
            needs_chart = w_type_str in {"bar", "line", "multi_line", "area", "pie"} and bool(widget.data)
            chart_h = 128.0 if needs_chart else 0.0
            min_section_h = 68.0 + chart_h + (45.0 if widget.data else 0.0)
            canvas.ensure_space(min(min_section_h, 250.0))

            # Widget Header Bar
            header_h = 26.0
            canvas.rect(MARGIN_X, canvas.y - header_h, CONTENT_W, header_h, fill=(0.93, 0.95, 0.98), stroke=(0.84, 0.88, 0.94), line_width=0.7)
            accent = PALETTE[(w_idx - 1) % len(PALETTE)]
            canvas.rect(MARGIN_X, canvas.y - header_h, 4.0, header_h, fill=accent)

            canvas.text(
                MARGIN_X + 12,
                canvas.y - 16,
                f"{w_idx}. {widget.title or 'Untitled Widget'}",
                size=10.5,
                bold=True,
                color=(0.08, 0.12, 0.20),
                max_chars=66,
            )
            badge_text = w_type_str.upper().replace("_", " ")
            canvas.text(
                MARGIN_X + CONTENT_W - 88,
                canvas.y - 16,
                f"[{badge_text}]",
                size=7.5,
                bold=True,
                color=accent,
                max_chars=16,
            )
            canvas.y -= header_h + 6.0

            # Statistical Insight Strip
            stats = _compute_widget_stats(widget)
            if "metric" in stats:
                stat_line = (
                    f"Measure: {stats['metric']}   |   Rows: {stats['rows']}   |   "
                    f"Total: {stats['total']}   |   Average: {stats['avg']}   |   "
                    f"Peak: {stats['max']}   |   Low: {stats['min']}"
                )
            else:
                stat_line = f"Rows: {stats.get('rows', '0')}   |   Type: {badge_text}"
            canvas.text(MARGIN_X + 4, canvas.y - 6, stat_line, size=7.5, color=(0.35, 0.42, 0.52), max_chars=105)
            canvas.y -= 14.0

            # Vector Chart Visual
            if needs_chart:
                canvas.ensure_space(chart_h + 10.0)
                if w_type_str == "bar":
                    _draw_bar_chart(canvas, widget, MARGIN_X, canvas.y, CONTENT_W, chart_h)
                elif w_type_str in {"line", "multi_line", "area"}:
                    _draw_line_chart(canvas, widget, MARGIN_X, canvas.y, CONTENT_W, chart_h)
                elif w_type_str == "pie":
                    _draw_pie_distribution(canvas, widget, MARGIN_X, canvas.y, CONTENT_W, chart_h)
                canvas.y -= chart_h + 8.0

            # Data Table
            if widget.data:
                _draw_table(canvas, widget.data, max_rows=10)
            else:
                canvas.text(MARGIN_X + 6, canvas.y - 8, "No materialized rows available for this widget.", size=8.0, color=(0.50, 0.55, 0.62))
                canvas.y -= 18.0

            canvas.y -= 6.0

    # ── 4. Attached Outputs / Media Appendix ────────────────────────────────
    if outputs:
        canvas.ensure_space(90.0)
        canvas.text(MARGIN_X, canvas.y, "ATTACHED DASHBOARD OUTPUTS & MEDIA", size=9.5, bold=True, color=(0.15, 0.23, 0.38))
        canvas.y -= 8.0
        canvas.line(MARGIN_X, canvas.y, MARGIN_X + CONTENT_W, canvas.y, color=(0.82, 0.86, 0.92), width=0.8)
        canvas.y -= 8.0
        output_rows = [
            {
                "Name": item.get("name", item.get("id", "")),
                "Type": item.get("type", "application/octet-stream"),
                "Size_MB": f"{(float(item.get('size', 0)) / 1_048_576):.2f} MB",
                "URL": item.get("url", ""),
            }
            for item in outputs
        ]
        _draw_table(canvas, output_rows, max_rows=20)

    return canvas.finalize_bytes()
