#!/usr/bin/env python3
"""Check the installed native candidate before an explicitly requested handoff.

Simulator iOS entitlements live in Mach-O sections, not the host code signature.
This check complements an actual in-app disposable Expo SecureStore probe; it
does not certify a store binary or submit a customer's login.
"""
import argparse
import hashlib
import json
import pathlib
import plistlib
import struct
import subprocess
import sys


def check(app, receipt):
    info = plistlib.loads((app / "Info.plist").read_bytes())
    bundle_id = info["CFBundleIdentifier"]
    assert bundle_id == "com.dominicbarela.strengthcoachui", "Wrong application"
    data = (app / info["CFBundleExecutable"]).read_bytes()
    if data[:4] == b"\xca\xfe\xba\xbe":
        count = struct.unpack_from(">I", data, 4)[0]
        slices = [struct.unpack_from(">IIIII", data, 8 + i * 20) for i in range(count)]
        arm = [entry for entry in slices if entry[0] == 0x0100000C]
        assert len(arm) == 1, "Missing arm64 simulator slice"
        base = arm[0][2]
    else:
        base = 0
    header = struct.unpack_from("<8I", data, base)
    assert header[0] == 0xFEEDFACF and header[1] == 0x0100000C, "Wrong architecture"
    pos = base + 32
    sections = {}
    for _ in range(header[4]):
        command, size = struct.unpack_from("<II", data, pos)
        assert size >= 8, "Invalid Mach-O command"
        if command == 0x19:
            segment = struct.unpack_from("<II16sQQQQiiII", data, pos)
            if segment[2].rstrip(b"\0") == b"__TEXT":
                for i in range(segment[-2]):
                    section = struct.unpack_from("<16s16sQQIIIIIIII", data, pos + 72 + i * 80)
                    name = section[0].rstrip(b"\0").decode()
                    if name in ("__entitlements", "__ents_der"):
                        sections[name] = data[base + section[4]:base + section[4] + section[3]]
        pos += size
    assert sections.get("__entitlements") and sections.get("__ents_der"), "Missing embedded simulator keychain entitlements"
    entitlements = plistlib.loads(sections["__entitlements"])
    application_id = entitlements.get("application-identifier", "")
    assert application_id == bundle_id or application_id.endswith("." + bundle_id), "Wrong keychain application identity"
    assert application_id in entitlements.get("keychain-access-groups", []), "Missing private application keychain group"
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True, capture_output=True)
    actual = hashlib.sha256((app / "main.jsbundle").read_bytes()).hexdigest()
    assert actual == receipt["bundleSHA256"], "Installed bundle is stale or differs from the tested candidate"
    assert receipt["temporaryProbeRemoved"], "Temporary probe remains in handoff"
    assert receipt["missingExportAssets"] == 0, "Candidate omits required exported assets"
    probe = receipt["nativeExpoSecureStoreProof"]
    assert probe["apiBase"] == receipt["apiBase"] == "https://app.strengthledger.fit", "Candidate is not using the actual live Production backend"
    for field in ("missingReadIsNull", "roundtrip", "deletedReadIsNull", "liveReady", "pass"):
        assert probe[field] is True, "Native runtime check failed: " + field
    assert probe["liveHealthStatus"] == 200, "Actual native live request failed"
    assert probe["liveSourceSHA"] == receipt["liveBackendSource"], "Live source proof differs"
    assert probe["realAuthKeysAccessed"] is False, "Probe accessed customer authentication keys"
    return {"pass": True, "bundleSHA256": actual, "apiBase": probe["apiBase"], "liveSourceSHA": probe["liveSourceSHA"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=pathlib.Path, required=True)
    parser.add_argument("--receipt", type=pathlib.Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(check(args.app, json.loads(args.receipt.read_text()))))
    except (AssertionError, KeyError, ValueError, OSError, subprocess.CalledProcessError) as error:
        print("SIMULATOR HANDOFF FAIL: " + str(error), file=sys.stderr)
        sys.exit(1)
