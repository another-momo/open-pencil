# -*- coding: utf-8 -*-
"""Subset Alibaba PuHuiTi TTFs to the CJK charset in tools/font-subset/charset-cjk.txt.

One-shot but replayable pipeline. Run from anywhere (venv with fonttools
lives at tools/font-subset/.venv, gitignored):

    tools/font-subset/.venv/Scripts/python tools/font-subset/subset-fonts.py

Sources (full vendor TTFs, not committed to this repo):
    D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/FONTS/
        AlibabaPuHuiTi-3-{35-Thin,45-Light,55-Regular,65-Medium,75-SemiBold,
                          85-Bold,95-ExtraBold,105-Heavy,115-Black}/...

Charset (tools/font-subset/charset-cjk.txt, committed) was built from:
    - 通用规范汉字表 8105 字 (level-1/2/3 txt from
      github.com/shengdoushi/common-standard-chinese-characters-table,
      fetched via cdn.jsdelivr.net mirror)
    - ASCII printable range, full GB2312 repertoire (incl. symbol rows),
      fullwidth ASCII/space, and common marketing/typographic symbols
      (￥ € © ® ™ ° ‰ × ÷ ± 「」【】《》〈〉 ...). 9031 unique chars total.

Notes:
    - The name table is preserved verbatim (--name-IDs='*' --name-legacy
      --name-languages='*') because the runtime registers fonts under clean
      family names hard-coded in packages/core/src/text/fonts.ts while the
      TTF name records carry vendor quirks (version suffixes, swapped
      family/subfamily on Bold).
    - Heavy/Black vendor sources ship only 9728 glyphs; they still cover all
      but ~11 marginal chars of the charset, which pyftsubset silently skips.
    - Output replaces AlibabaPuHuiTi-*.ttf in both public/ and
      packages/core/assets/ (the repo keeps the two copies in sync).
"""

import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FONTS_DIR = os.path.join(os.path.dirname(REPO_ROOT), 'FONTS')
CHARSET_FILE = os.path.join(REPO_ROOT, 'tools', 'font-subset', 'charset-cjk.txt')
OUTPUT_DIRS = [
    os.path.join(REPO_ROOT, 'public'),
    os.path.join(REPO_ROOT, 'packages', 'core', 'assets'),
]

# output name -> vendor source dir suffix
WEIGHTS = {
    'Thin': '35-Thin',
    'Light': '45-Light',
    'Regular': '55-Regular',
    'Medium': '65-Medium',
    'SemiBold': '75-SemiBold',
    'Bold': '85-Bold',
    'ExtraBold': '95-ExtraBold',
    'Heavy': '105-Heavy',
    'Black': '115-Black',
}


def source_path(suffix):
    name = f'AlibabaPuHuiTi-3-{suffix}'
    return os.path.join(FONTS_DIR, name, name, f'{name}.ttf')


def make_options():
    opts = subset.Options()
    opts.name_IDs = ['*']
    opts.name_legacy = True
    opts.name_languages = ['*']
    opts.layout_features = ['*']
    opts.hinting = False
    opts.flavor = None  # plain TTF, no woff/woff2
    return opts


def main():
    with open(CHARSET_FILE, encoding='utf-8') as fp:
        charset = fp.read()
    print(f'charset: {len(charset)} chars from {CHARSET_FILE}')

    total_in = total_out = 0
    for weight, suffix in WEIGHTS.items():
        src = source_path(suffix)
        out_name = f'AlibabaPuHuiTi-{weight}.ttf'
        if not os.path.exists(src):
            print(f'ERROR: source missing: {src}', file=sys.stderr)
            sys.exit(1)

        in_size = os.path.getsize(src)
        font = subset.load_font(src, make_options())
        subsetter = subset.Subsetter(make_options())
        subsetter.populate(text=charset)
        subsetter.subset(font)

        for out_dir in OUTPUT_DIRS:
            font.save(os.path.join(out_dir, out_name))
        font.close()

        out_file = os.path.join(OUTPUT_DIRS[0], out_name)
        out_size = os.path.getsize(out_file)
        with TTFont(out_file, lazy=True) as check:
            glyph_count = check['maxp'].numGlyphs

        total_in += in_size
        total_out += out_size
        print(
            f'{out_name}: {in_size / 1e6:.2f}MB -> {out_size / 1e6:.2f}MB, '
            f'{glyph_count} glyphs'
        )

    print(
        f'total (per location): {total_in / 1e6:.2f}MB -> '
        f'{total_out / 1e6:.2f}MB'
    )


if __name__ == '__main__':
    main()
