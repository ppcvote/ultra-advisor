#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract-pdf-text.py — Sprint 14 W2 任務 B1

抽 ~22k 條款 PDF 的純文字 + 表格偵測，產出 JSONL 給 chunking + embedding pipeline。

Pipeline:
  PDF → pdfplumber → per-page text + tables → JSONL
  totalChars < 500 → mark needsOcr (Pass 2 用 Gemini Vision 處理)

使用 ProcessPoolExecutor (pdfplumber 是 CPU-bound、釋 GIL good)。
Per-PDF 30s hard timeout (跑 subprocess、超時直接 terminate)。
Resume 模式: 啟動時讀已 output 的 productId、自動 skip。

CLI:
  python scripts/extract-pdf-text.py \
    --input-dir c:/Users/User/insurance-db/research-only/pdfs_full \
    --output    c:/Users/User/insurance-db/research-only/pdf-text.jsonl \
    --workers 8 \
    --limit 100 \
    --resume \
    --timeout 30

依賴:
  pip install pdfplumber

不引入 npm dep (Python pip, OK)。
不在 module top-level 取 timestamp — 一律 callback 內 datetime.now().isoformat()。
"""

from __future__ import annotations

import argparse
import json
import logging
import multiprocessing as mp
import os
import re
import signal
import sys
import time
import unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed, TimeoutError as FuturesTimeout
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

# pdfplumber 進子 worker 才 import (主進程不需要、加快啟動)
# 但這裡 module-level 也先 try 一次驗證可用
try:
    import pdfplumber  # noqa: F401
except ImportError:
    sys.stderr.write(
        "[fatal] pdfplumber not installed. Run: pip install pdfplumber\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# slugify — 對齊 Sprint 13b parse-insurance-database.cjs (35,823 筆 0 衝突)
# ---------------------------------------------------------------------------

# 注意: 順序對齊 .cjs 的 MARK_CHAR_MAP。$ 沒有 leading dash (它跟 0-9 一樣
# 可緊接 alphanum)、其他 punctuation 都用 -xxx 形式。
MARK_CHAR_MAP: dict[str, str] = {
    '$': 'dollarsign',
    '.': '-dot',
    '/': '-slash',
    '%': '-pct',
    '&': '-amp',
    '@': '-at',
    '!': '-bang',
    '#': '-hash',
    '(': '-lp',
    ')': '-rp',
    '+': '-plus',
    '*': '-star',
    '?': '-q',
    '<': '-lt',
    '>': '-gt',
    '=': '-eq',
    ':': '-col',
    ';': '-sc',
    ',': '-cma',
    '\\': '-bs',
    '|': '-pipe',
    '~': '-tld',
    '^': '-crt',
    '"': '-dq',
    "'": '-sq',
    '`': '-bt',
    '[': '-lb',
    ']': '-rb',
    '{': '-lc',
    '}': '-rc',
}

_ALNUM_RE = re.compile(r'[a-z0-9\-]')
_WS_RE = re.compile(r'\s')
_DASH_COLLAPSE_RE = re.compile(r'-+')
_LEADING_TRAILING_DASH_RE = re.compile(r'^-+|-+$')


def slugify_product_code(code: str) -> str:
    """對齊 Sprint 13b slugifyMark (parse-insurance-database.cjs).

    Rules:
      - lowercase
      - [a-z0-9-] 直接保留
      - whitespace → '-'
      - $ / . / ! / # / % & @ ( ) + * ? < > = : ; , \\ | ~ ^ " ' ` [ ] { } → 對應字串
      - CJK / 其他 → drop
      - 合併連續 dash、strip leading/trailing dash
    """
    if not code or not isinstance(code, str):
        return ''
    out_chars: list[str] = []
    for ch in code.lower():
        if _ALNUM_RE.fullmatch(ch):
            out_chars.append(ch)
            continue
        if _WS_RE.fullmatch(ch):
            out_chars.append('-')
            continue
        mapped = MARK_CHAR_MAP.get(ch)
        if mapped:
            out_chars.append(mapped)
            continue
        # 其他 (CJK / unknown punctuation) drop
    raw = ''.join(out_chars)
    raw = _DASH_COLLAPSE_RE.sub('-', raw)
    raw = _LEADING_TRAILING_DASH_RE.sub('', raw)
    return raw


def filename_to_product_id(filename: str) -> tuple[str, str, str] | None:
    """ADE_27.pdf → (productId, companyNo, productCode).

    Pattern: {COMPANY}_{CODE}.pdf
    CODE 可含 _ (eg ADE_27-1.pdf)，所以以第一個 _ 為分界。
    """
    stem = Path(filename).stem
    if '_' not in stem:
        return None
    company, code = stem.split('_', 1)
    company = company.strip()
    code = code.strip()
    if not company or not code:
        return None
    slug = slugify_product_code(code)
    if not slug:
        slug = 'unknown'
    product_id = f'tii_{company.lower()}_{slug}'
    return product_id, company, code


# ---------------------------------------------------------------------------
# CJK ratio
# ---------------------------------------------------------------------------

def cjk_char_ratio(text: str) -> float:
    """中日韓字元佔比 (0.0 - 1.0)。空字串回 0.0。"""
    if not text:
        return 0.0
    total = 0
    cjk = 0
    for ch in text:
        if ch.isspace():
            continue
        total += 1
        # CJK Unified Ideographs + Extension A + Compatibility + Hiragana/Katakana + Hangul
        cp = ord(ch)
        if (
            0x4E00 <= cp <= 0x9FFF
            or 0x3400 <= cp <= 0x4DBF
            or 0xF900 <= cp <= 0xFAFF
            or 0x3040 <= cp <= 0x309F
            or 0x30A0 <= cp <= 0x30FF
            or 0xAC00 <= cp <= 0xD7AF
        ):
            cjk += 1
    if total == 0:
        return 0.0
    return round(cjk / total, 4)


# ---------------------------------------------------------------------------
# 單 PDF 抽取 worker (run in child process)
# ---------------------------------------------------------------------------

@dataclass
class PageInfo:
    pageNum: int
    text: str
    charCount: int
    hasTables: bool


@dataclass
class ExtractResult:
    productId: str
    fileName: str
    sizeKb: float
    pages: list[dict[str, Any]] = field(default_factory=list)
    totalChars: int = 0
    cjkRatio: float = 0.0
    pageCount: int = 0
    extractMethod: str = 'pdfplumber'
    needsOcr: bool = False
    extractedAt: str = ''
    elapsedMs: int = 0
    error: str | None = None
    companyNo: str | None = None
    productCode: str | None = None


# Threshold: 平均一頁 < 100 char 視為掃描檔
NEEDS_OCR_TOTAL_THRESHOLD = 500


def _extract_one(pdf_path_str: str) -> dict[str, Any]:
    """單 PDF 處理。在 child process 跑。回 dict (好 JSON serialize)。

    Result 永遠回 (即使 error)、由 main 決定寫 main jsonl 還 errors jsonl。
    """
    # 子進程內才取 timestamp
    started_ms = time.monotonic()
    pdf_path = Path(pdf_path_str)
    fname = pdf_path.name

    parsed = filename_to_product_id(fname)
    if parsed is None:
        return {
            '_kind': 'error',
            'fileName': fname,
            'productId': None,
            'error': f'invalid_filename: {fname}',
            'extractedAt': datetime.now(timezone.utc).isoformat(),
        }
    product_id, company_no, product_code = parsed

    try:
        size_kb = round(pdf_path.stat().st_size / 1024.0, 1)
    except OSError as e:
        return {
            '_kind': 'error',
            'fileName': fname,
            'productId': product_id,
            'companyNo': company_no,
            'productCode': product_code,
            'error': f'stat_failed: {e}',
            'extractedAt': datetime.now(timezone.utc).isoformat(),
        }

    pages: list[dict[str, Any]] = []
    total_chars = 0
    page_count = 0
    full_text_buf: list[str] = []

    # pdfplumber 在 child process 內 import (subprocess fork-safe)
    import pdfplumber as _pp

    try:
        with _pp.open(str(pdf_path)) as pdf:
            page_count = len(pdf.pages)
            for idx, page in enumerate(pdf.pages, start=1):
                try:
                    txt = page.extract_text() or ''
                except Exception as page_err:
                    # 單頁壞掉不放棄整個 PDF
                    txt = ''
                    pages.append({
                        'pageNum': idx,
                        'text': '',
                        'charCount': 0,
                        'hasTables': False,
                        'error': f'page_extract_failed: {page_err}',
                    })
                    continue

                # 表格偵測 (boolean, 不抽內容 — 內容已在 text 裡)
                try:
                    tables = page.find_tables()
                    has_tables = bool(tables)
                except Exception:
                    has_tables = False

                # Normalize whitespace, 但保留換行 (chunking 需要)
                txt = txt.replace('\r\n', '\n').replace('\r', '\n')

                cc = len(txt)
                total_chars += cc
                full_text_buf.append(txt)
                pages.append({
                    'pageNum': idx,
                    'text': txt,
                    'charCount': cc,
                    'hasTables': has_tables,
                })
    except Exception as e:
        elapsed = int((time.monotonic() - started_ms) * 1000)
        return {
            '_kind': 'error',
            'fileName': fname,
            'productId': product_id,
            'companyNo': company_no,
            'productCode': product_code,
            'error': f'pdfplumber_failed: {type(e).__name__}: {e}',
            'extractedAt': datetime.now(timezone.utc).isoformat(),
            'elapsedMs': elapsed,
        }

    needs_ocr = total_chars < NEEDS_OCR_TOTAL_THRESHOLD
    cjk_ratio = cjk_char_ratio(''.join(full_text_buf))

    # 若 needs OCR、清空 page text (省 jsonl 體積、Pass 2 會重抽)
    if needs_ocr:
        for p in pages:
            p['text'] = ''
            p['charCount'] = 0

    result = ExtractResult(
        productId=product_id,
        fileName=fname,
        sizeKb=size_kb,
        pages=pages,
        totalChars=total_chars,
        cjkRatio=cjk_ratio,
        pageCount=page_count,
        extractMethod='pdfplumber',
        needsOcr=needs_ocr,
        extractedAt=datetime.now(timezone.utc).isoformat(),
        elapsedMs=int((time.monotonic() - started_ms) * 1000),
        error=None,
        companyNo=company_no,
        productCode=product_code,
    )
    d = asdict(result)
    d['_kind'] = 'ok'
    return d


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def _load_resume_ids(output_path: Path) -> set[str]:
    """讀已存在 output jsonl 抽 productId set (resume mode)。

    壞行 (parse 失敗) skip 不 abort。
    """
    done: set[str] = set()
    if not output_path.exists():
        return done
    try:
        with output_path.open('r', encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                pid = obj.get('productId')
                if isinstance(pid, str) and pid:
                    done.add(pid)
    except OSError as e:
        sys.stderr.write(f'[warn] resume read failed: {e}\n')
    return done


def _human_eta(remaining: int, rate_per_sec: float) -> str:
    if rate_per_sec <= 0:
        return 'n/a'
    secs = int(remaining / rate_per_sec)
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return f'{h:02d}:{m:02d}:{s:02d}'


def run(args: argparse.Namespace) -> int:
    input_dir = Path(args.input_dir)
    output_path = Path(args.output)
    errors_path = output_path.with_suffix(output_path.suffix + '.errors')
    if errors_path == output_path:
        errors_path = output_path.parent / (output_path.name + '.errors')
    # 保底命名: pdf-text.jsonl → pdf-text.errors.jsonl (語意更清楚)
    if output_path.name.endswith('.jsonl'):
        errors_path = output_path.parent / output_path.name.replace(
            '.jsonl', '.errors.jsonl'
        )

    if not input_dir.is_dir():
        sys.stderr.write(f'[fatal] input dir not found: {input_dir}\n')
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    errors_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. 列 PDF
    pdfs = sorted(p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == '.pdf')
    total_pdfs = len(pdfs)
    if total_pdfs == 0:
        sys.stderr.write(f'[fatal] no PDFs in {input_dir}\n')
        return 2

    # 2. Resume filter
    done_ids: set[str] = set()
    if args.resume:
        done_ids = _load_resume_ids(output_path)
        sys.stderr.write(f'[resume] {len(done_ids):,} productIds already in output, will skip\n')

    todo: list[Path] = []
    skipped_resume = 0
    invalid_name = 0
    for p in pdfs:
        parsed = filename_to_product_id(p.name)
        if parsed is None:
            invalid_name += 1
            continue
        pid = parsed[0]
        if pid in done_ids:
            skipped_resume += 1
            continue
        todo.append(p)

    if args.limit is not None and args.limit > 0:
        todo = todo[: args.limit]

    sys.stderr.write(
        f'[plan] total_pdfs={total_pdfs:,} invalid_name={invalid_name} '
        f'skipped_resume={skipped_resume} to_process={len(todo):,} '
        f'workers={args.workers} timeout={args.timeout}s\n'
    )

    if not todo:
        sys.stderr.write('[done] nothing to do\n')
        return 0

    # 3. ProcessPool with per-task timeout
    processed = 0
    ok_count = 0
    err_count = 0
    needs_ocr_count = 0
    start_wall = time.monotonic()
    last_log_at = start_wall

    # 開 output 用 line-buffered append (resume-safe — crash 不丟已寫的)
    out_fh = output_path.open('a', encoding='utf-8', buffering=1)
    err_fh = errors_path.open('a', encoding='utf-8', buffering=1)

    try:
        ctx = mp.get_context('spawn')  # Windows fork-safe
        with ProcessPoolExecutor(max_workers=args.workers, mp_context=ctx) as pool:
            # Submit all → as_completed with per-future timeout
            future_to_path = {pool.submit(_extract_one, str(p)): p for p in todo}

            for fut in as_completed(future_to_path):
                p = future_to_path[fut]
                processed += 1
                try:
                    result = fut.result(timeout=args.timeout)
                except FuturesTimeout:
                    err_count += 1
                    err_obj = {
                        '_kind': 'error',
                        'fileName': p.name,
                        'productId': (filename_to_product_id(p.name) or (None,))[0],
                        'error': f'timeout_after_{args.timeout}s',
                        'extractedAt': datetime.now(timezone.utc).isoformat(),
                    }
                    err_fh.write(json.dumps(err_obj, ensure_ascii=False) + '\n')
                    fut.cancel()
                except Exception as e:
                    err_count += 1
                    err_obj = {
                        '_kind': 'error',
                        'fileName': p.name,
                        'productId': (filename_to_product_id(p.name) or (None,))[0],
                        'error': f'worker_exception: {type(e).__name__}: {e}',
                        'extractedAt': datetime.now(timezone.utc).isoformat(),
                    }
                    err_fh.write(json.dumps(err_obj, ensure_ascii=False) + '\n')
                else:
                    kind = result.pop('_kind', 'ok')
                    if kind == 'error':
                        err_count += 1
                        err_fh.write(json.dumps(result, ensure_ascii=False) + '\n')
                    else:
                        ok_count += 1
                        if result.get('needsOcr'):
                            needs_ocr_count += 1
                        out_fh.write(json.dumps(result, ensure_ascii=False) + '\n')

                # Progress every 100 PDFs
                if processed % 100 == 0:
                    now = time.monotonic()
                    elapsed = now - start_wall
                    rate = processed / elapsed if elapsed > 0 else 0
                    remaining = len(todo) - processed
                    eta = _human_eta(remaining, rate)
                    sys.stderr.write(
                        f'[progress] {processed:,}/{len(todo):,} '
                        f'ok={ok_count:,} err={err_count} needsOcr={needs_ocr_count} '
                        f'rate={rate:.1f}/s eta={eta}\n'
                    )
                    last_log_at = now
    finally:
        out_fh.close()
        err_fh.close()

    elapsed = time.monotonic() - start_wall
    rate = processed / elapsed if elapsed > 0 else 0
    sys.stderr.write(
        f'[done] processed={processed:,} ok={ok_count:,} err={err_count} '
        f'needsOcr={needs_ocr_count} elapsed={elapsed:.1f}s avg_rate={rate:.1f}/s\n'
    )
    sys.stderr.write(f'[out] {output_path}\n[err] {errors_path}\n')
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='extract-pdf-text.py',
        description='Sprint 14 W2 — extract insurance clause PDFs to JSONL (pdfplumber)',
    )
    p.add_argument(
        '--input-dir',
        default='c:/Users/User/insurance-db/research-only/pdfs_full',
        help='PDF directory (default: %(default)s)',
    )
    p.add_argument(
        '--output',
        default='c:/Users/User/insurance-db/research-only/pdf-text.jsonl',
        help='Output JSONL path (default: %(default)s)',
    )
    p.add_argument(
        '--workers',
        type=int,
        default=8,
        help='ProcessPool workers (default: %(default)s)',
    )
    p.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Process only first N PDFs (sample mode)',
    )
    p.add_argument(
        '--resume',
        action='store_true',
        help='Skip productIds already in output JSONL',
    )
    p.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Per-PDF timeout seconds (default: %(default)s)',
    )
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.workers < 1:
        sys.stderr.write('[fatal] --workers must be >= 1\n')
        return 2
    if args.timeout < 5:
        sys.stderr.write('[fatal] --timeout must be >= 5s (pdfplumber needs warmup)\n')
        return 2
    return run(args)


if __name__ == '__main__':
    # Windows ProcessPool 需要 main guard
    mp.freeze_support()
    sys.exit(main())
