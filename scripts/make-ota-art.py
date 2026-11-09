#!/usr/bin/env python3
"""生成 OTA 资源热更演示用的图片素材 ota-demo/assets/ota-art.png。

用法:
  python3 scripts/make-ota-art.py [--variant v1|v2]

  v1（默认，随 git 提交）: 绿色块 + 斜纹 + "ASSET V1"
  v2（发布热更前临时生成）: 橙色块 + 斜纹 + "ASSET V2"

v1/v2 用与背景色（蓝/红）不同的颜色，截图里可以单独断言这块资源是否真的被换掉。
依赖 Pillow（运行时自带）。
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "ota-demo", "assets", "ota-art.png")

W, H = 600, 240
VARIANTS = {
    #            底色            斜纹色           文案
    "v1": ((0x2E, 0xCC, 0x71), (0x27, 0xAE, 0x60), "ASSET V1"),
    "v2": ((0xF5, 0xA6, 0x23), (0xE0, 0x8E, 0x0B), "ASSET V2"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=sorted(VARIANTS), default="v1")
    args = parser.parse_args()
    base, stripe, label = VARIANTS[args.variant]

    img = Image.new("RGB", (W, H), base)
    draw = ImageDraw.Draw(img)

    # 45° 斜纹，让图片不只是一块纯色
    for x in range(-H, W + H, 48):
        draw.line([(x, 0), (x + H, H)], fill=stripe, width=16)

    # 白色内边框
    draw.rectangle([6, 6, W - 7, H - 7], outline="white", width=6)

    # 中央标签（白底黑字，字体尽力放大，旧版 Pillow 退化为点阵小字）
    try:
        font = ImageFont.load_default(size=64)
    except TypeError:
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), label, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    tx, ty = (W - tw) // 2 - box[0], (H - th) // 2 - box[1]
    draw.rectangle([tx - 24, ty - 16, tx + tw + 24, ty + th + 16], fill="white")
    draw.text((tx, ty), label, fill="#222222", font=font)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print(f"已生成 {args.variant} 版资源: {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
