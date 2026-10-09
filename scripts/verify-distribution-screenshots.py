#!/usr/bin/env python3
"""Check native PNGs against the owner's actual App Store upload slot.

Use the slot shown in App Store Connect, not the physical device diagonal.
The 6.5-inch contract comes from the owner's October 9, 2026 upload screenshot.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

PORTRAIT_SLOTS = {
    "iphone-6.5-inch": {(1242, 2688), (1284, 2778)},
    "ipad-13-inch": {(2064, 2752), (2048, 2732)},
}


def inspect_png(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path.name}: not PNG")
    offset, header, ended = 8, None, False
    while offset < len(data):
        size = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + size]
        crc = struct.unpack_from(">I", data, offset + 8 + size)[0]
        if zlib.crc32(kind + payload) & 0xffffffff != crc:
            raise ValueError(f"{path.name}: corrupt PNG chunk")
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", payload)
        if kind == b"tRNS":
            raise ValueError(f"{path.name}: transparency is not allowed")
        offset += 12 + size
        if kind == b"IEND":
            ended = True
            break
    if not header or not ended or offset != len(data):
        raise ValueError(f"{path.name}: incomplete PNG")
    width, height, depth, color, *_ = header
    if depth != 8 or color != 2:
        raise ValueError(f"{path.name}: expected 8-bit RGB without alpha")
    return width, height, hashlib.sha256(data).hexdigest()


def audit(directory, slot):
    directory = Path(directory)
    files = sorted(directory.glob("*.png"))
    if not 1 <= len(files) <= 10:
        raise ValueError(f"{directory}: expected 1–10 PNGs, found {len(files)}")
    rows = []
    for path in files:
        width, height, digest = inspect_png(path)
        if (width, height) not in PORTRAIT_SLOTS[slot]:
            allowed = ", ".join(f"{w}x{h}" for w, h in sorted(PORTRAIT_SLOTS[slot]))
            raise ValueError(
                f"{path.name}: {width}x{height} does not fit {slot}; accepted: {allowed}"
            )
        rows.append({"file": path.name, "width": width, "height": height, "sha256": digest})
    return {"slot": slot, "count": len(rows), "screenshots": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--slot", required=True, choices=PORTRAIT_SLOTS)
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.directory, args.slot), indent=2))
    except (ValueError, OSError, struct.error) as exc:
        print(f"SCREENSHOT DELIVERY BLOCKED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
