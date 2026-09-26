#!/usr/bin/env python3
"""Build EPUB 3 editions of the five books from the book pages in books/.

The Nepali original text of every piece (and the front matter) is taken from
the `.works` section of each book page, so the EPUBs stay in sync with the
website. Re-run after editing a book page:

    pip install beautifulsoup4 lxml pillow
    python3 tools/build_epub.py

Output: epub/<slug>.epub. Noto Serif Devanagari (SIL OFL 1.1, see
tools/fonts/OFL.txt) is embedded so Devanagari renders on e-readers that
lack a system font for it.
"""

import io
import re
import uuid
import zipfile
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "epub"
FONTS = Path(__file__).resolve().parent / "fonts"

AUTHOR = "मुक्तिनाथ शर्मा 'शोषित'"
AUTHOR_LATIN = "Muktinath Sharma 'Shoshit'"
SITE = "https://shoshit.in"

BOOKS = [
    # slug, cover file, Latin title
    ("man-ra-ma", "man-ra-ma-cover.jpg", "Man ra Ma"),
    ("prakaran", "prakaran-cover.png", "Prakaran"),
    ("dochhaya", "dochhaya-cover.jpg", "Dochhaya"),
    ("shoshitka-shabdaharu", "shoshitka-shabdaharu-cover.png", "Shoshitka Shabdaharu"),
    ("ujyalo-khojdai", "ujyalo-khojdai-cover.png", "Ujyalo Khojdai"),
]

CSS = """\
@font-face { font-family: "Noto Serif Devanagari"; font-weight: normal; font-style: normal;
  src: url(../fonts/NotoSerifDevanagari-Regular.ttf); }
@font-face { font-family: "Noto Serif Devanagari"; font-weight: bold; font-style: normal;
  src: url(../fonts/NotoSerifDevanagari-SemiBold.ttf); }
body { font-family: "Noto Serif Devanagari", serif; line-height: 1.8; margin: 0 5%; }
h1, h2 { font-weight: bold; text-align: center; line-height: 1.4; }
h1 { font-size: 1.8em; margin: 2em 0 .4em; }
h2 { font-size: 1.4em; margin: 0 0 1.4em; }
.kicker { text-align: center; font-size: .85em; color: #7a5c3a; margin: 2.5em 0 .3em;
  letter-spacing: .05em; }
.byname { text-align: center; font-size: .95em; margin: -1em 0 1.6em; }
p { margin: 0 0 1em; text-align: justify; }
.stanza { text-align: left; margin: 0 0 1.2em; }
.verse-block { margin: 0 auto; }
.sig { text-align: right; font-size: .9em; margin-top: 1.4em; color: #555; }
.center { text-align: center; }
.title-page { text-align: center; }
.title-page .author { font-size: 1.2em; margin: 1em 0 3em; }
.title-page .meta { font-size: .9em; color: #555; margin: .3em 0; text-align: center; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: .4em 0; }
"""


def xhtml(title, body, lang="ne", extra_head="", epub_type=""):
    et = f' epub:type="{epub_type}"' if epub_type else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="{lang}" xml:lang="{lang}">
<head>
<meta charset="UTF-8"/>
<title>{escape(title)}</title>
<link rel="stylesheet" type="text/css" href="../css/book.css"/>{extra_head}
</head>
<body{et}>
{body}
</body>
</html>
"""


def text_of(el):
    return re.sub(r"\s+", " ", el.get_text()).strip() if el else ""


def lines_to_html(text):
    """Escape and turn single newlines into <br/> (CSS white-space: pre-line)."""
    lines = [l.strip() for l in text.strip().split("\n")]
    return "<br/>".join(escape(l, quote=False) for l in lines)


def blocks(text):
    return [b for b in re.split(r"\n\s*\n", text) if b.strip()]


def convert(node, mode):
    """Convert the children of a `.trans.lang-ne` node (or a nested one) to XHTML.

    mode: "flow" (blank line = paragraph), "verse" (blank line = stanza) or
    "plain" (whitespace-only text between elements is dropped).
    """
    out = []
    for child in node.children:
        if isinstance(child, NavigableString):
            if child.__class__.__name__ == "Comment":
                continue
            s = str(child)
            if not s.strip():
                continue
            if mode == "verse":
                out += [f'<p class="stanza">{lines_to_html(b)}</p>' for b in blocks(s)]
            else:
                out += [f"<p>{lines_to_html(b)}</p>" for b in blocks(s)]
            continue
        if not isinstance(child, Tag):
            continue
        cls = child.get("class") or []
        if "verse" in cls:
            out.append('<div class="verse-block">' + "".join(convert(child, "verse")) + "</div>")
        elif "prose-flow" in cls:
            out += convert(child, "flow")
        elif child.name == "p":
            c = ' class="sig"' if "sig" in cls else ""
            out.append(f"<p{c}>{inline(child)}</p>")
        elif child.name in ("ol", "ul"):
            items = "".join(f"<li>{inline(li)}</li>" for li in child.find_all("li", recursive=False))
            out.append(f"<{child.name}>{items}</{child.name}>")
        elif child.name == "br":
            continue
        else:
            out += convert(child, mode)
    return out


def inline(el):
    """Inline content of a <p>/<li>: keep text, <br>, <em>, <strong>."""
    parts = []
    for c in el.children:
        if isinstance(c, NavigableString):
            parts.append(escape(re.sub(r"\s+", " ", str(c)), quote=False))
        elif c.name == "br":
            parts.append("<br/>")
        elif c.name in ("em", "strong", "i", "b"):
            tag = {"i": "em", "b": "strong"}.get(c.name, c.name)
            parts.append(f"<{tag}>{inline(c)}</{tag}>")
        else:
            parts.append(inline(c))
    return "".join(parts).strip()


def chapter_for(el):
    """Return (heading, subheading, kicker, body_html) for a .works child."""
    ne = el.find(class_="lang-ne")
    mode = "flow" if "prose-flow" in (ne.get("class") or []) else "plain"
    body = "\n".join(convert(ne, mode))
    if el.name == "article":
        kicker = text_of(el.find(class_="kicker"))
        heading = text_of(el.find("h3"))
        # untitled pieces (the muktaks) use their number as the heading
        return (heading, "", kicker, body) if heading else (kicker, "", "", body)
    heading = text_of(el.find(class_="fm-type"))
    return heading, text_of(el.find(class_="fm-name")), "", body


def cover_jpeg(path):
    img = Image.open(path).convert("RGB")
    img.thumbnail((1600, 2400))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85, optimize=True)
    return buf.getvalue()


def build(slug, cover_name, latin_title):
    page = BeautifulSoup((ROOT / "books" / f"{slug}.html").read_text(encoding="utf-8"), "lxml")
    title = text_of(page.select_one(".work-hero h1"))
    eyebrow = text_of(page.select_one(".work-hero .eyebrow"))
    sub = text_of(page.select_one(".work-hero .sub"))
    description = page.select_one('meta[name="description"]')["content"]
    year = re.search(r"\d{4}", page.select_one('meta[property="book:release_date"]')["content"]).group()
    book_id = f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, f'{SITE}/books/{slug}.html')}"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    files = {}  # path inside OEBPS -> bytes
    spine = []  # (name, href)
    toc = []    # (href, label)
    first_chapter = None

    files["images/cover.jpg"] = cover_jpeg(ROOT / "images" / "covers" / cover_name)
    files["css/book.css"] = CSS.encode()
    for f in ("NotoSerifDevanagari-Regular.ttf", "NotoSerifDevanagari-SemiBold.ttf"):
        files[f"fonts/{f}"] = (FONTS / f).read_bytes()

    files["text/cover.xhtml"] = xhtml(
        title,
        f'<div class="cover"><img src="../images/cover.jpg" alt="{escape(title)} — {escape(AUTHOR)}"/></div>',
        epub_type="cover",
    ).encode()
    spine.append(("cover", "text/cover.xhtml"))

    meta = "".join(f'<p class="meta">{escape(m)}</p>' for m in (eyebrow, sub) if m)
    files["text/title.xhtml"] = xhtml(
        title,
        f'<section class="title-page" epub:type="titlepage"><h1>{escape(title)}</h1>'
        f'<p class="author center">{escape(AUTHOR)}</p>{meta}'
        f'<p class="meta">{SITE}</p></section>',
    ).encode()
    spine.append(("title", "text/title.xhtml"))
    toc.append(("text/title.xhtml", title))

    for i, el in enumerate(page.select_one(".works").find_all(["article", "div"], recursive=False), 1):
        if not el.find(class_="lang-ne"):
            continue
        heading, byname, kicker, body = chapter_for(el)
        name = f"c{i:03d}"
        href = f"text/{name}.xhtml"
        parts = []
        if kicker:
            parts.append(f'<p class="kicker">{escape(kicker)}</p>')
        else:
            parts.append('<p class="kicker">&#160;</p>')
        parts.append(f"<h2>{escape(heading)}</h2>")
        if byname:
            parts.append(f'<p class="byname">{escape(byname)}</p>')
        parts.append(body)
        etype = "chapter" if el.name == "article" else "frontmatter"
        if etype == "chapter" and not first_chapter:
            first_chapter = href
        files[href] = xhtml(heading, f'<section epub:type="{etype}">\n' + "\n".join(parts) + "\n</section>").encode()
        spine.append((name, href))
        label = f"{heading} — {byname}" if byname else heading
        toc.append((href, label))

    nav_items = "\n".join(f'<li><a href="{h[5:]}">{escape(l)}</a></li>' for h, l in toc)
    files["text/nav.xhtml"] = xhtml(
        "विषय-सूची",
        f'<nav epub:type="toc" id="toc"><h2>विषय-सूची</h2><ol>\n{nav_items}\n</ol></nav>\n'
        f'<nav epub:type="landmarks" hidden=""><ol>'
        f'<li><a epub:type="cover" href="cover.xhtml">Cover</a></li>'
        f'<li><a epub:type="titlepage" href="title.xhtml">Title page</a></li>'
        f'<li><a epub:type="toc" href="nav.xhtml">विषय-सूची</a></li>'
        f'<li><a epub:type="bodymatter" href="{first_chapter[5:]}">Start</a></li>'
        f"</ol></nav>",
    ).encode()
    spine.insert(2, ("nav", "text/nav.xhtml"))

    media = {".xhtml": "application/xhtml+xml", ".css": "text/css", ".jpg": "image/jpeg", ".ttf": "font/ttf"}
    special = {"images/cover.jpg": ("cover-image", "cover-image"), "text/nav.xhtml": ("nav", "nav")}
    ids = {p: special.get(p, (re.sub(r"[^A-Za-z0-9]", "-", p),))[0] for p in files}
    manifest = []
    for path in files:
        props = f' properties="{special[path][1]}"' if path in special else ""
        manifest.append(f'<item id="{ids[path]}" href="{path}" media-type="{media[Path(path).suffix]}"{props}/>')
    spine_xml = "\n".join(f'<itemref idref="{ids[h]}"/>' for _, h in spine)

    opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ne">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">{book_id}</dc:identifier>
<dc:title id="t1">{escape(title)}</dc:title>
<meta refines="#t1" property="title-type">main</meta>
<dc:title id="t2">{escape(latin_title)}</dc:title>
<meta refines="#t2" property="title-type">subtitle</meta>
<dc:creator id="a1">{escape(AUTHOR)}</dc:creator>
<meta refines="#a1" property="role" scheme="marc:relators">aut</meta>
<meta refines="#a1" property="alternate-script" xml:lang="en">{escape(AUTHOR_LATIN)}</meta>
<meta refines="#a1" property="file-as">Sharma, Muktinath</meta>
<dc:language>ne</dc:language>
<dc:date>{year}</dc:date>
<dc:description>{escape(description)}</dc:description>
<dc:source>{SITE}/books/{slug}.html</dc:source>
<dc:publisher>shoshit.in</dc:publisher>
<meta property="dcterms:modified">{modified}</meta>
<meta name="cover" content="cover-image"/>
</metadata>
<manifest>
{chr(10).join(manifest)}
</manifest>
<spine>
{spine_xml}
</spine>
</package>
"""

    container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
"""

    OUT.mkdir(exist_ok=True)
    dest = OUT / f"{slug}.epub"
    fixed = (2026, 1, 1, 0, 0, 0)  # stable zip timestamps
    with zipfile.ZipFile(dest, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype", fixed), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        entries = {"META-INF/container.xml": container.encode(), "OEBPS/content.opf": opf.encode()}
        entries.update({f"OEBPS/{p}": b for p, b in files.items()})
        for name, data in entries.items():
            z.writestr(zipfile.ZipInfo(name, fixed), data, compress_type=zipfile.ZIP_DEFLATED)
    print(f"{dest.relative_to(ROOT)}: {len(toc) - 1} sections, {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for book in BOOKS:
        build(*book)
