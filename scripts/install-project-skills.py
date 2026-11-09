"""Pinned project-only bridge to the unmodified Codex standard skill installer."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    {"name": "superpowers", "repo": "obra/superpowers", "revision": "22f0b463e7a5e579904dd6211a520321035526f7", "checkout": "superpowers"},
    {"name": "ui-ux-pro-max", "repo": "nextlevelbuilder/ui-ux-pro-max-skill", "revision": "4f2dbb67e64969a9a30ab00742f2d55d66ddec2b", "checkout": "ui-ux-pro-max"},
    {"name": "security-audit", "repo": "cloudflare/security-audit-skill", "revision": "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8", "checkout": "security-audit"},
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer", required=True, help="Read-reviewed Codex standard install-skill-from-github.py")
    args = parser.parse_args()
    helper = Path(args.installer).resolve()
    if helper.name != "install-skill-from-github.py" or not helper.is_file():
        raise SystemExit("標準skill-installerの実ファイルを指定してください。")
    target = ROOT / ".agents" / "skills"
    temporary = ROOT / ".local" / "skill-installer-tmp"
    temporary.mkdir(parents=True, exist_ok=True)
    os.environ["TEMP"] = str(temporary)
    os.environ["TMP"] = str(temporary)
    os.environ.pop("GITHUB_TOKEN", None)
    os.environ.pop("GH_TOKEN", None)
    sys.path.insert(0, str(helper.parent))
    for source in SOURCES:
        checkout = ROOT / ".skill-sources" / source["checkout"]
        actual = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        if actual != source["revision"]:
            raise SystemExit("公式checkoutの固定revisionが一致しません。")
        paths = sorted(str(p.relative_to(checkout)).replace("\\", "/") for p in (checkout / "skills").iterdir() if p.is_dir()) if source["name"] == "superpowers" else ["skills/security-audit"] if source["name"] == "security-audit" else [".claude/skills/ui-ux-pro-max"]
        # UI/UX source is first acquired with the standard helper; its reviewed official
        # Codex generator installs the final platform-specific copy in the next step.
        destination = ROOT / ".local" / "skill-staging" if source["name"] == "ui-ux-pro-max" else target
        sys.argv = [str(helper), "--repo", source["repo"], "--ref", source["revision"], "--path", *paths, "--dest", str(destination), "--method", "download"]
        try:
            runpy.run_path(str(helper), run_name="__main__")
        except SystemExit as result:
            if result.code not in (None, 0):
                raise
        source["source_paths"] = paths
        source["standard_installer_destination"] = str(destination.relative_to(ROOT)).replace("\\", "/")
    report = {"method": "unmodified-codex-skill-installer", "helper_sha256": hashlib.sha256(helper.read_bytes()).hexdigest(), "sources": SOURCES}
    (ROOT / "docs" / "skill-installation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

if __name__ == "__main__":
    main()

