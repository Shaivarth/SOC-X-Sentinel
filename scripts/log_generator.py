import random
import time
from datetime import datetime

# Users
users = [
    "admin",
    "root",
    "guest",
    "test",
    "finance_admin",
    "devops",
    "security",
    "oracle_user"
]

# Countries
countries = [
    "Russia",
    "China",
    "North Korea",
    "USA",
    "Germany",
    "India",
    "Brazil",
    "Iran"
]

# Attack/Event Types
events = [
    "FAILED_LOGIN",
    "SUCCESSFUL_LOGIN",
    "SSH_BRUTE_FORCE",
    "PASSWORD_SPRAY",
    "ADMIN_LOGIN",
    "USER_ENUMERATION",
    "MULTIPLE_SESSION_ATTEMPT"
]

# Severities
severity_map = {
    "FAILED_LOGIN": "MEDIUM",
    "SUCCESSFUL_LOGIN": "LOW",
    "SSH_BRUTE_FORCE": "HIGH",
    "PASSWORD_SPRAY": "HIGH",
    "ADMIN_LOGIN": "MEDIUM",
    "USER_ENUMERATION": "HIGH",
    "MULTIPLE_SESSION_ATTEMPT": "CRITICAL"
}

# MITRE ATT&CK Mapping
mitre_map = {
    "FAILED_LOGIN": "T1110",
    "SUCCESSFUL_LOGIN": "T1078",
    "SSH_BRUTE_FORCE": "T1110.001",
    "PASSWORD_SPRAY": "T1110.003",
    "ADMIN_LOGIN": "T1078",
    "USER_ENUMERATION": "T1087",
    "MULTIPLE_SESSION_ATTEMPT": "T1098"
}


def generate_ip():
    return ".".join(str(random.randint(1, 255)) for _ in range(4))


while True:

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    user = random.choice(users)

    event = random.choice(events)

    severity = severity_map[event]

    mitre = mitre_map[event]

    source_ip = generate_ip()

    country = random.choice(countries)

    attempts = random.randint(1, 50)

    log = (
        f"[{timestamp}] "
        f"EVENT={event} "
        f"USER={user} "
        f"IP={source_ip} "
        f"COUNTRY={country} "
        f"SEVERITY={severity} "
        f"ATTEMPTS={attempts} "
        f"MITRE={mitre}"
    )

    with open("../logs/auth.log", "a") as f:
        f.write(log + "\n")

    print(log)

    time.sleep(random.randint(1, 3))