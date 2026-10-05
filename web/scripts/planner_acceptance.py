"""Run exact frontend-generated inputs through the real CPython webapi."""
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import json
from pathlib import Path
import sys
import time
import traceback

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "app"))


def optimize_case(request, class_data_dir):
    from aion2c import webapi

    started = time.perf_counter()
    response = {"id": request["id"], "request": request}
    try:
        class_key = request["args"]["build"]["class_key"]
        data = json.loads((Path(class_data_dir) / f"{class_key}.json").read_text(encoding="utf-8"))
        webapi.register_gamedata(class_key, data)
        response["engineCurrencies"] = {key: board.currency for key, board in webapi._gd(class_key).daevanion.items()}
        full = webapi.optimize(**request["args"])
        response["result"] = {key: full[key] for key in ("build", "priority", "current_dps", "playstyle", "daevanion_path")}
        response["result"]["result"] = {"dps": full["result"]["dps"]}
        response["result"]["variants"] = [
            {key: variant[key] for key in ("key", "build", "dps")}
            | ({"priority": variant["priority"]} if "priority" in variant else {})
            for variant in full["variants"]
        ]
        json.dumps(response, allow_nan=False)
    except Exception:
        response.pop("result", None)
        response["error"] = traceback.format_exc()
    response["elapsedSeconds"] = round(time.perf_counter() - started, 3)
    return response


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("requests", type=Path)
    parser.add_argument("outputs", type=Path)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")
    artifact_dir = Path(__file__).resolve().parents[1] / ".planner-acceptance"
    if args.outputs.resolve().parent != artifact_dir.resolve():
        parser.error("Outputs must stay in web/.planner-acceptance")
    document = json.loads(args.requests.read_text(encoding="utf-8"))
    with args.outputs.open("w", encoding="utf-8") as output, ProcessPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(optimize_case, case, document["classDataDir"]): case for case in document["cases"]}
        for job in as_completed(jobs):
            case = jobs[job]
            try:
                response = job.result()
            except Exception:
                response = {"id": case["id"], "request": case, "error": traceback.format_exc()}
            output.write(json.dumps(response, allow_nan=False, separators=(",", ":")) + "\n")
            output.flush()
            print(f"{response['id']}: {'ERROR' if 'error' in response else 'optimized'} ({response.get('elapsedSeconds', 0)}s)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
