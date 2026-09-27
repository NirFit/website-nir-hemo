#!/usr/bin/env python3
"""Apply verbatim reviews from scripts/reviews.json into the site HTML."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEWS_PATH = Path(__file__).resolve().parent / "reviews.json"

GOOGLE_REVIEWS_URL = (
    "https://search.google.com/local/reviews?placeid=ChIJV2Gkbhy3HRURluKid7BL_2g"
)
LIMUD_NAIM_URL = (
    "https://www.limudnaim.co.il/%D7%9E%D7%90%D7%9E%D7%9F-%D7%90%D7%99%D7%A9%D7%99/%D7%A0%D7%99%D7%A8-%D7%97%D7%9E%D7%95"
)
STARS = (
    '<i class="fas fa-star"></i><i class="fas fa-star"></i>'
    '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>'
)
PLATFORM_LINE = "5.0 בגוגל (51 ביקורות) · 10 מתוך 10 בלימוד נעים (133 מדרגים)"

HOME_LN_REPLACE = {
    "אביב כ.": "ln-05",
    "אביב": "ln-04",
    "אבי": "ln-06",
    "רועי": "ln-07",
    "דניאל": "ln-08",
    "מוחמד": "ln-09",
    "מוטי": "ln-10",
}

GOOGLE_HOME_IDS = [
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

AFULA_CARDS = [
    ("ln-08", "דניאל", "ד", "לימוד נעים", LIMUD_NAIM_URL, "ביקורת בלימוד נעים"),
    ("ln-06", "אבי", "א", "לימוד נעים", LIMUD_NAIM_URL, "ביקורת בלימוד נעים"),
    ("g-01", None, None, "ביקורת בגוגל", GOOGLE_REVIEWS_URL, "ביקורת בגוגל"),
    ("g-04", None, None, "ביקורת בגוגל", GOOGLE_REVIEWS_URL, "ביקורת בגוגל"),
    ("g-05", None, None, "ביקורת בגוגל", GOOGLE_REVIEWS_URL, "ביקורת בגוגל"),
    ("g-06", None, None, "ביקורת בגוגל", GOOGLE_REVIEWS_URL, "ביקורת בגוגל"),
]


def load_reviews() -> dict[str, dict]:
    data = json.loads(REVIEWS_PATH.read_text(encoding="utf-8"))
    return {item["id"]: item for item in data["reviews"]}


def review_text_html(text: str) -> str:
    return html.escape(text, quote=False).replace("\n", "<br>")


def initials_for(name: str) -> str:
    parts = [part for part in name.split() if part]
    if not parts:
        return "?"
    first = parts[0][0]
    if len(parts) == 1:
        return first.upper() if first.isascii() else first
    second = parts[1][0]
    if first.isascii() and second.isascii():
        return (first + second).upper()
    return f"{first}.{second}"


def card_html(
    review: dict,
    *,
    display_name: str | None = None,
    avatar: str | None = None,
    subtitle: str | None = None,
    badge_url: str,
    badge_label: str,
    extra_class: str = "",
    hidden: bool = False,
) -> str:
    name = display_name if display_name is not None else review["name"]
    avatar_text = avatar if avatar is not None else initials_for(name)
    subtitle_text = subtitle if subtitle is not None else badge_label
    classes = "testimonial-card" + (f" {extra_class}" if extra_class else "")
    hidden_attr = " hidden" if hidden else ""
    text = review_text_html(review["text"])
    return f"""                    <div class="{classes}" data-review-id="{review["id"]}"{hidden_attr}>
                        <div class="testimonial-rating">
                            <div class="testimonial-stars">
                                {STARS}
                            </div>
                            <a class="testimonial-badge" href="{badge_url}" target="_blank" rel="noopener">{badge_label}</a>
                        </div>
                        <p class="testimonial-text">"{text}"</p>
                        <div class="testimonial-author">
                            <div class="author-avatar">{html.escape(avatar_text)}</div>
                            <div class="author-info">
                                <strong>{html.escape(name)}</strong>
                                <span>{html.escape(subtitle_text)}</span>
                            </div>
                        </div>
                    </div>"""


def platform_links_html() -> str:
    return f"""            <p class="reviews-platforms">{PLATFORM_LINE}</p>
            <p class="reviews-links">
                <a href="{GOOGLE_REVIEWS_URL}" target="_blank" rel="noopener">לכל הביקורות בגוגל</a>
                <span class="reviews-links-sep" aria-hidden="true"> · </span>
                <a href="{LIMUD_NAIM_URL}" target="_blank" rel="noopener">לכל הביקורות בלימוד נעים</a>
            </p>"""


def replace_named_card_text(page: str, display_name: str, review: dict) -> str:
    name_token = f"<strong>{display_name}</strong>"
    name_indexes = [match.start() for match in re.finditer(re.escape(name_token), page)]
    if len(name_indexes) != 1:
        raise SystemExit(f"expected 1 author {display_name!r}, found {len(name_indexes)}")
    name_idx = name_indexes[0]
    card_start = page.rfind('<div class="testimonial-card"', 0, name_idx)
    if card_start == -1:
        raise SystemExit(f"card start not found for {display_name!r}")
    card_chunk = page[card_start:name_idx]
    new_text = f'<p class="testimonial-text">"{review_text_html(review["text"])}"</p>'
    card_chunk, count = re.subn(
        r'<p class="testimonial-text">.*?</p>',
        new_text,
        card_chunk,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise SystemExit(f"expected 1 review paragraph for {display_name!r}, found {count}")
    if "data-review-id=" not in card_chunk.split(">", 1)[0]:
        card_chunk = card_chunk.replace(
            '<div class="testimonial-card"',
            f'<div class="testimonial-card" data-review-id="{review["id"]}"',
            1,
        )
    return page[:card_start] + card_chunk + page[name_idx:]


def mark_extra_home_cards(page: str) -> str:
    track_start = page.find('id="testimonialsTrack"')
    track_end = page.find('id="testimonialsShowMore"')
    if track_start == -1 or track_end == -1:
        raise SystemExit("homepage testimonials track/show-more markers missing")
    opener = '<div class="testimonial-card"'
    section = page[track_start:track_end]
    in_track = [track_start + match.start() for match in re.finditer(re.escape(opener), section)]
    if len(in_track) < 7:
        raise SystemExit(f"expected many homepage cards, found {len(in_track)}")
    for pos in reversed(in_track[6:]):
        end = page.find(">", pos)
        opening = page[pos : end + 1]
        if "testimonial-more" not in opening:
            opening = opening.replace(
                'class="testimonial-card"',
                'class="testimonial-card testimonial-more"',
            )
        if " hidden" not in opening and " hidden>" not in opening:
            opening = opening[:-1] + " hidden>"
        page = page[:pos] + opening + page[end + 1 :]
    return page


def update_index(reviews: dict[str, dict]) -> None:
    path = ROOT / "index.html"
    page = path.read_text(encoding="utf-8")

    # Longer names first so "אביב כ." is not consumed by "אביב".
    for name in sorted(HOME_LN_REPLACE, key=len, reverse=True):
        page = replace_named_card_text(page, name, reviews[HOME_LN_REPLACE[name]])

    google_cards = "\n\n".join(
        card_html(
            reviews[review_id],
            badge_url=GOOGLE_REVIEWS_URL,
            badge_label="ביקורת בגוגל",
        )
        for review_id in GOOGLE_HOME_IDS
    )
    marker = "                </div>\n                <div class=\"slider-controls\""
    if marker not in page:
        raise SystemExit("homepage slider marker not found")
    page = page.replace(marker, google_cards + "\n" + marker, 1)

    old_cta = """            <div class="reviews-cta">
                <a href="https://www.google.com/search?q=NIRFIT+ניר+חמו+מאמן+כושר+קריות+ביקורות" class="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer">
                    <i class="fab fa-google"></i> קראו ביקורות בגוגל
                </a>
                <a href="https://www.limudnaim.co.il/%D7%9E%D7%90%D7%9E%D7%9F-%D7%90%D7%99%D7%A9%D7%99/%D7%A0%D7%99%D7%A8-%D7%97%D7%9E%D7%95" class="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer">
                    <i class="fas fa-star"></i> כל הביקורות בלימוד נעים
                </a>
            </div>
            """
    if old_cta not in page:
        raise SystemExit("homepage reviews-cta block not found")
    page = page.replace(old_cta, "", 1)

    page = page.replace(
        '<div class="testimonials-track" id="testimonialsTrack">',
        '<div class="testimonials-track testimonials-grid" id="testimonialsTrack">',
        1,
    )

    old_controls = """                <div class="slider-controls" role="group" aria-label="ניווט המלצות">
                    <button class="slider-btn prev" id="prevBtn" aria-label="המלצה קודמת" type="button">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                    <div class="slider-dots" id="sliderDots" role="tablist" aria-label="בחירת המלצה"></div>
                    <button class="slider-btn next" id="nextBtn" aria-label="המלצה הבאה" type="button">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                </div>"""
    new_controls = f"""                <button type="button" class="testimonials-show-more" id="testimonialsShowMore" aria-expanded="false" aria-controls="testimonialsTrack">הצג עוד ביקורות</button>
{platform_links_html()}"""
    if old_controls not in page:
        raise SystemExit("homepage slider controls not found")
    page = page.replace(old_controls, new_controls, 1)

    page = mark_extra_home_cards(page)
    path.write_text(page, encoding="utf-8")
    print("updated index.html")


def update_afula(reviews: dict[str, dict]) -> None:
    path = ROOT / "afula" / "index.html"
    page = path.read_text(encoding="utf-8")
    cards = []
    for review_id, display_name, avatar, subtitle, badge_url, badge_label in AFULA_CARDS:
        cards.append(
            card_html(
                reviews[review_id],
                display_name=display_name,
                avatar=avatar,
                subtitle=subtitle,
                badge_url=badge_url,
                badge_label=badge_label,
            )
        )
    section = f"""
    <section class="section testimonials testimonials-compact" id="testimonials">
        <div class="container">
            <div class="section-label text-center">מה אומרים עליי</div>
            <h2 class="section-title text-center">המלצות <span class="text-primary">מתאמנים</span></h2>
            <div class="title-line center"></div>
            <p class="testimonials-disclaimer">ההמלצות מלקוחות אמיתיים. התוצאות אישיות ומשתנות מאדם לאדם.</p>
            <div class="testimonials-grid">
{chr(10).join(cards)}
            </div>
{platform_links_html()}
        </div>
    </section>

"""
    marker = '    <section class="section contact" id="contact">'
    if marker not in page:
        raise SystemExit("afula contact section marker not found")
    if 'id="testimonials"' in page:
        raise SystemExit("afula already has testimonials")
    page = page.replace(marker, section + marker, 1)
    path.write_text(page, encoding="utf-8")
    print("updated afula/index.html")


def main() -> None:
    reviews = load_reviews()
    update_index(reviews)
    update_afula(reviews)


if __name__ == "__main__":
    main()
