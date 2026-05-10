from flask import Flask, render_template, jsonify, request
import json
import os
from collections import defaultdict
from datetime import datetime

app = Flask(
    __name__,
    template_folder="../templates",
    static_folder="../static"
)

ALERT_FILE = "/home/shaivarth/SOC_Project/logs/alerts.json"


def load_alerts():
    """Load and parse alerts from the JSON file."""
    alerts = []
    try:
        with open(ALERT_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    alerts.append(json.loads(line))
    except Exception:
        pass
    return alerts


def compute_stats(alerts):
    """Compute dashboard statistics from alert list."""
    total = len(alerts)
    critical = len([a for a in alerts if a.get("severity") == "CRITICAL"])
    high = len([a for a in alerts if a.get("severity") == "HIGH"])
    medium = len([a for a in alerts if a.get("severity") == "MEDIUM"])
    low = len([a for a in alerts if a.get("severity") == "LOW"])

    # Unique attackers (by username or source_ip if available)
    attackers = set()
    for a in alerts:
        if a.get("username"):
            attackers.add(a["username"])
        if a.get("source_ip"):
            attackers.add(a["source_ip"])

    # Alert type distribution
    type_dist = defaultdict(int)
    for a in alerts:
        atype = a.get("alert_type", "Unknown")
        type_dist[atype] += 1

    # Hourly distribution (last 24 hours buckets)
    hourly = defaultdict(int)
    for a in alerts:
        ts = a.get("timestamp", "")
        try:
            # Try to parse hour from timestamp
            dt = datetime.fromisoformat(ts)
            hour_key = dt.strftime("%H:00")
            hourly[hour_key] += 1
        except Exception:
            hourly["??:00"] += 1

    return {
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "unique_attackers": len(attackers),
        "type_dist": dict(type_dist),
        "hourly": dict(hourly),
    }


@app.route("/")
def home():
    alerts = load_alerts()
    alerts.reverse()
    stats = compute_stats(alerts)

    return render_template(
        "index.html",
        alerts=alerts,
        total_alerts=stats["total"],
        critical=stats["critical"],
        high=stats["high"],
        medium=stats["medium"],
        low=stats["low"],
        unique_attackers=stats["unique_attackers"],
    )


@app.route("/api/alerts")
def api_alerts():
    """Return alerts as JSON for live refresh."""
    alerts = load_alerts()
    alerts.reverse()

    # Optional filtering
    severity_filter = request.args.get("severity", "").upper()
    search_query = request.args.get("q", "").lower()

    if severity_filter:
        alerts = [a for a in alerts if a.get("severity") == severity_filter]
    if search_query:
        alerts = [
            a for a in alerts
            if search_query in str(a.get("username", "")).lower()
            or search_query in str(a.get("alert_type", "")).lower()
            or search_query in str(a.get("source_ip", "")).lower()
        ]

    return jsonify(alerts)


@app.route("/api/stats")
def api_stats():
    """Return computed stats as JSON for live chart refresh."""
    alerts = load_alerts()
    stats = compute_stats(alerts)
    return jsonify(stats)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)