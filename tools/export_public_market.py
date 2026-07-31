#!/usr/bin/env python3
"""Export one compact, read-only market snapshot into a D1-compatible SQL file."""
from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


def plain(value) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in text if not unicodedata.combining(char)).casefold().strip()


def sql(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def compact_payload(row: dict) -> dict:
    out = {key: value for key, value in row.items() if key not in {
        "_search", "raw_json", "bonuses_json", "sockets_json", "attrs_json",
    }}
    return out


def payload(row: dict) -> str:
    return json.dumps(compact_payload(row), ensure_ascii=False, separators=(",", ":"))


def insert_many(handle, table: str, columns: list[str], rows: list[list], batch_size: int = 20) -> None:
    if not rows:
        return
    for start in range(0, len(rows), batch_size):
        chunk = rows[start:start + batch_size]
        values = ",\n".join("(" + ",".join(sql(value) for value in row) + ")" for row in chunk)
        handle.write(f"INSERT INTO {table} ({','.join(columns)}) VALUES\n{values};\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", type=Path, required=True, help="Path to the local shop-backend directory")
    parser.add_argument("--database", type=Path, help="SQLite source; defaults to backend/data/m2_shop_local.sqlite3")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    backend = args.backend.resolve()
    database = (args.database or backend / "data" / "m2_shop_local.sqlite3").resolve()
    sys.path.insert(0, str(backend))
    import local_server  # pylint: disable=import-error,import-outside-toplevel
    import market_search  # pylint: disable=import-error,import-outside-toplevel

    con = local_server.db_connect(database)
    market = local_server.market_cache(con, force=True)
    index = market_search._build_index(con, market)  # Deliberate export boundary.
    active_pairs = {(str(row.get("realm_key", "")), str(row.get("market_key", ""))) for row in index["offers"]}
    active_merchants = {int(row.get("merchant_id") or 0) for row in index["offers"]}
    stats = [row for row in market["stats"] if (str(row.get("realm_key", "")), str(row.get("market_key", ""))) in active_pairs]
    flips = local_server.api_flipper(con, limit=10_000, min_profit=0, min_margin=0,
                                     min_confidence=0, min_listings=1, max_buy=0, min_sales=0)
    cross = local_server.api_cross_realm_flipper(con, limit=10_000, min_profit=0, min_margin=0,
                                                  min_confidence=0, min_listings=1, max_buy=0, min_sales=0)
    merchants = [row for row in local_server.api_merchants(con, limit=5_000) if int(row.get("id") or 0) in active_merchants]
    summary = local_server.api_dashboard_summary(con)
    facets = {**index["facets"], "active_offers": len(index["offers"])}

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as out:
        out.write("PRAGMA foreign_keys=OFF;\n")
        for table in ("public_listing_bonuses", "public_listings", "public_market_stats", "public_flips", "public_merchants", "public_meta"):
            out.write(f"DELETE FROM {table};\n")

        meta_rows = [
            ["facets", json.dumps(facets, ensure_ascii=False, separators=(",", ":"))],
            ["summary", json.dumps(summary, ensure_ascii=False, separators=(",", ":"), default=str)],
            ["as_of", json.dumps(summary.get("as_of", ""), ensure_ascii=False)],
            ["exported_at", json.dumps(datetime.now(timezone.utc).isoformat(), ensure_ascii=False)],
        ]
        insert_many(out, "public_meta", ["key", "value_json"], meta_rows)

        listing_rows, bonus_rows = [], []
        for listing_id, raw in enumerate(index["offers"], 1):
            row = local_server.decode_item(raw)
            row["category_key"] = raw["category_key"]
            row["category_label"] = raw["category_label"]
            row["item_type"] = raw["item_type"]
            row["subtype"] = raw["subtype"]
            row["merchant_id"] = int(row.get("merchant_id") or 0)
            listing_rows.append([
                listing_id, int(row.get("state_id") or 0), int(row.get("slot") or 0),
                int(row.get("vnum") or 0), str(row.get("market_key") or row.get("vnum") or ""),
                plain(" ".join(str(row.get(key, "")) for key in ("name", "display_name", "market_key", "vnum"))),
                row["category_key"], str(row.get("realm_key") or ""), int(row.get("unit_price") or 0),
                str(row.get("observed_at") or ""), row["merchant_id"], payload(row),
            ])
            seen = set()
            for bonus in row.get("bonuses", []):
                key = market_search._bonus_key(bonus)
                value = market_search._bonus_value(bonus)
                signature = (key, value)
                if key != "name:" and signature not in seen:
                    bonus_rows.append([listing_id, key, value])
                    seen.add(signature)
        insert_many(out, "public_listings", ["id", "state_id", "slot", "vnum", "market_key", "name_search", "category_key", "realm_key", "unit_price", "observed_at", "merchant_id", "payload_json"], listing_rows)
        insert_many(out, "public_listing_bonuses", ["listing_id", "bonus_key", "value"], bonus_rows, 50)

        stat_rows = []
        for stat_id, row in enumerate(stats, 1):
            decoded = dict(row)
            decoded["offers"] = decoded.get("listings", 0)
            stat_rows.append([
                stat_id, int(row.get("vnum") or 0), str(row.get("market_key") or ""),
                str(row.get("realm_key") or ""), plain(" ".join(str(row.get(key, "")) for key in ("name", "market_key", "vnum"))),
                int(row.get("listings") or 0), int(row.get("median_unit_price") or 0), payload(decoded),
            ])
        insert_many(out, "public_market_stats", ["id", "vnum", "market_key", "realm_key", "name_search", "listings", "median_unit_price", "payload_json"], stat_rows)

        flip_rows = []
        for flip_id, row in enumerate([*flips, *cross], 1):
            flip_rows.append([
                flip_id, str(row.get("flip_type") or "local"), str(row.get("realm_key") or row.get("buy_realm_key") or ""),
                plain(" ".join(str(row.get(key, "")) for key in ("name", "display_name", "market_key", "vnum"))),
                int(row.get("current_price") or 0), int(row.get("profit_per_item") or 0), int(row.get("total_profit") or 0),
                int(row.get("margin_pct") or 0), int(row.get("confidence") or 0), int(row.get("liquidity_score") or 0),
                int(row.get("opportunity_score") or 0), int(row.get("listings") or 0), float(row.get("estimated_sales_30d") or 0), payload(row),
            ])
        insert_many(out, "public_flips", ["id", "flip_type", "realm_key", "name_search", "current_price", "profit_per_item", "total_profit", "margin_pct", "confidence", "liquidity_score", "opportunity_score", "listings", "estimated_sales_30d", "payload_json"], flip_rows)

        merchant_rows = []
        for row in merchants:
            merchant_rows.append([
                int(row.get("id") or 0), plain(f"{row.get('owner_name', '')} {row.get('shop_name', '')}"),
                str(row.get("observed_at") or ""), payload(row),
            ])
        insert_many(out, "public_merchants", ["id", "owner_search", "observed_at", "payload_json"], merchant_rows)
        out.write("PRAGMA optimize;\n")

    report = {
        "database": str(database), "output": str(args.output), "as_of": summary.get("as_of", ""),
        "listings": len(listing_rows), "bonuses": len(bonus_rows), "stats": len(stat_rows),
        "flips": len(flips), "cross_flips": len(cross), "merchants": len(merchant_rows),
        "bytes": args.output.stat().st_size,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
