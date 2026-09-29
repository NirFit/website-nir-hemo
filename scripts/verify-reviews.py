#!/usr/bin/env python3
"""Compare review card text in the HTML to scripts/reviews.json (normalized whitespace)."""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWS_PATH = Path(__file__).resolve().parent / "reviews.json"

HOME_REQUIRED = [
    "ln-04",
    "ln-05",
    "ln-06",
    "ln-07",
    "ln-08",
    "ln-09",
    "ln-10",
    "g-01",
    "g-04",
    "g-05",
    "g-06",
    "g-08",
    "g-09",
    "g-10",
    "g-11",
    "g-12",
    "g-13",
]
AFULA_REQUIRED = ["ln-08", "ln-06", "g-01", "g-04", "g-05", "g-06"]
SKIPPED = ["g-02", "g-03", "g-07", "g-14"]
HOME_EXISTING_NAMES = [
    "יוסי כ.",
    "מיכל ש.",
    "דני א.",
    "שירה ל.",
    "אבי מ.",
    "רון ג.",
    "אביב",
    "אביב כ.",
    "אבי",
    "רועי",
    "דניאל",
    "מוחמד",
    "מוטי",
    "קורל",
    "אביאל",
    "ניב",
    "נטע ב.",
    "עומר ד.",
    "תמר ל.",
    "אלון ש.",
    "ריטה ק.",
    "יואב ג.",
    "סיון פ.",
    "דביר א.",
    "הילה מ.",
    "רן ט.",
    "Yarden",
    "Miriam",
    "hana",
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def inner_to_text(inner: str) -> str:
    inner = re.sub(r"<br\s*/?>", "\n", inner, flags=re.I)
    inner = re.sub(r"<[^>]+>", "", inner)
    inner = html.unescape(inner)
    inner = inner.strip()
    if len(inner) >= 2 and inner[0] == '"' and inner[-1] == '"':
        inner = inner[1:-1]
    return inner


def cards_from(page: str) -> list[dict]:
    cards = []
    for match in re.finditer(
        r'<div class="testimonial-card[^"]*"(?P<attrs>[^>]*)>(?P<body>.*?)</div>\s*</div>\s*</div>',
        page,
        flags=re.DOTALL,
    ):
        attrs = match.group("attrs")
        body = match.group("body")
        review_id = re.search(r'data-review-id="([^"]+)"', attrs)
        text_match = re.search(r'<p class="testimonial-text">(.*?)</p>', body, flags=re.DOTALL)
        name_match = re.search(
            r'<div class="author-info">\s*<strong>(.*?)</strong>',
            body,
            flags=re.DOTALL,
        )
        if not text_match or not name_match:
            continue
        cards.append(
            {
                "id": review_id.group(1) if review_id else None,
                "name": html.unescape(name_match.group(1)),
                "text": inner_to_text(text_match.group(1)),
            }
        )
    return cards


def compare_required(label: str, cards: list[dict], required: list[str], reviews: dict) -> list[str]:
    lines = [f"## {label}"]
    by_id = {card["id"]: card for card in cards if card["id"]}
    ok = 0
    for review_id in required:
        expected = reviews[review_id]
        card = by_id.get(review_id)
        if not card:
            lines.append(f"FAIL {review_id}: missing card")
            continue
        same_text = normalize(card["text"]) == normalize(expected["text"])
        # Google cards must keep the file name; Limud Naim homepage cards keep site display names.
        if review_id.startswith("g-"):
            same_name = card["name"] == expected["name"]
        else:
            same_name = True
        if same_text and same_name:
            ok += 1
            lines.append(f"OK   {review_id}  name={card['name']!r}  chars={len(expected['text'])}")
        else:
            lines.append(f"FAIL {review_id}  name_ok={same_name} text_ok={same_text}")
            if not same_name:
                lines.append(f"     html_name={card['name']!r} json_name={expected['name']!r}")
            if not same_text:
                lines.append(f"     html={normalize(card['text'])[:120]!r}")
                lines.append(f"     json={normalize(expected['text'])[:120]!r}")
    lines.append(f"matched {ok}/{len(required)}")
    return lines


def skipped_present(cards: list[dict], reviews: dict) -> list[str]:
    lines = ["## skipped Google ids/names must not appear as their own cards"]
    forbidden_names = {reviews[review_id]["name"] for review_id in SKIPPED}
    present = []
    for review_id in SKIPPED:
        hits = [card for card in cards if card["id"] == review_id]
        if hits:
            present.append(review_id)
            lines.append(f"FAIL {review_id} data-review-id found")
        else:
            lines.append(f"OK   {review_id} id absent")
    for name in sorted(forbidden_names):
        hits = [card for card in cards if card["name"] == name]
        if hits:
            present.append(name)
            lines.append(f"FAIL skipped Google name {name!r} found as author")
        else:
            lines.append(f"OK   skipped Google name {name!r} absent")
    if not present:
        lines.append("matched skipped-absent")
    return lines


def existing_names_present(cards: list[dict]) -> list[str]:
    lines = ["## existing homepage names still present"]
    names = [card["name"] for card in cards]
    missing = [name for name in HOME_EXISTING_NAMES if name not in names]
    if missing:
        lines.append(f"FAIL missing {missing}")
    else:
        lines.append(f"OK   all {len(HOME_EXISTING_NAMES)} existing names still present")
    return lines


def main() -> int:
    reviews = {item["id"]: item for item in json.loads(REVIEWS_PATH.read_text(encoding="utf-8"))["reviews"]}
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    afula = (ROOT / "afula/index.html").read_text(encoding="utf-8")
    home_cards = cards_from(home)
    afula_cards = cards_from(afula)

    lines = [
        f"homepage cards parsed: {len(home_cards)}",
        f"afula cards parsed: {len(afula_cards)}",
        "",
    ]
    lines.extend(compare_required("homepage required reviews", home_cards, HOME_REQUIRED, reviews))
    lines.append("")
    lines.extend(compare_required("afula required reviews", afula_cards, AFULA_REQUIRED, reviews))
    lines.append("")
    lines.extend(skipped_present(home_cards + afula_cards, reviews))
    lines.append("")
    lines.extend(existing_names_present(home_cards))

    output = "\n".join(lines)
    print(output)
    failed = "FAIL" in output
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
