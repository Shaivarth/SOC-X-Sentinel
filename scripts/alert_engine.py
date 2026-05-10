import time
import json
from collections import defaultdict
from datetime import datetime

LOG_FILE = "../logs/auth.log"
ALERT_FILE = "../logs/alerts.json"

# Track failed attempts
failed_attempts = defaultdict(int)

# Track already processed logs
processed_logs = set()


def create_alert(
    alert_type,
    severity,
    username,
    source_ip,
    country,
    attempts,
    mitre
):

    alert = {
        "alert_id": f"SOC-{int(time.time())}",
        "timestamp": str(datetime.now()),
        "alert_type": alert_type,
        "severity": severity,
        "username": username,
        "source_ip": source_ip,
        "country": country,
        "attempts": attempts,
        "mitre": mitre,
        "status": "OPEN"
    }

    with open(ALERT_FILE, "a") as f:
        f.write(json.dumps(alert) + "\n")

    print(f"[ALERT] {alert_type} detected for {username}")


while True:

    try:

        with open(LOG_FILE, "r") as f:

            lines = f.readlines()

        for line in lines:

            line = line.strip()

            if line in processed_logs:
                continue

            processed_logs.add(line)

            # Parse fields
            parts = line.split()

            data = {}

            for part in parts:

                if "=" in part:

                    key, value = part.split("=", 1)

                    data[key] = value

            event = data.get("EVENT", "")
            username = data.get("USER", "unknown")
            source_ip = data.get("IP", "unknown")
            country = data.get("COUNTRY", "unknown")
            severity = data.get("SEVERITY", "LOW")
            mitre = data.get("MITRE", "unknown")

            attempts = int(data.get("ATTEMPTS", 1))

            # ------------------------------------
            # Detection 1 — SSH Brute Force
            # ------------------------------------

            if event == "SSH_BRUTE_FORCE":

                failed_attempts[username] += attempts

                if failed_attempts[username] >= 20:

                    create_alert(
                        "BRUTE_FORCE_ATTACK",
                        "HIGH",
                        username,
                        source_ip,
                        country,
                        failed_attempts[username],
                        mitre
                    )

                    failed_attempts[username] = 0

            # ------------------------------------
            # Detection 2 — Password Spray
            # ------------------------------------

            elif event == "PASSWORD_SPRAY":

                create_alert(
                    "PASSWORD_SPRAY_ATTACK",
                    "HIGH",
                    username,
                    source_ip,
                    country,
                    attempts,
                    mitre
                )

            # ------------------------------------
            # Detection 3 — User Enumeration
            # ------------------------------------

            elif event == "USER_ENUMERATION":

                create_alert(
                    "USER_ENUMERATION",
                    "MEDIUM",
                    username,
                    source_ip,
                    country,
                    attempts,
                    mitre
                )

            # ------------------------------------
            # Detection 4 — Multiple Sessions
            # ------------------------------------

            elif event == "MULTIPLE_SESSION_ATTEMPT":

                create_alert(
                    "MULTIPLE_SESSION_ATTACK",
                    "CRITICAL",
                    username,
                    source_ip,
                    country,
                    attempts,
                    mitre
                )

            # ------------------------------------
            # Detection 5 — Suspicious Admin Login
            # ------------------------------------

            elif event == "ADMIN_LOGIN":

                if country in ["Russia", "North Korea", "Iran"]:

                    create_alert(
                        "SUSPICIOUS_ADMIN_LOGIN",
                        "CRITICAL",
                        username,
                        source_ip,
                        country,
                        attempts,
                        mitre
                    )

    except Exception as e:

        print("Error:", e)

    time.sleep(2)