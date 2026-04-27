"""
Reset admin credentials directly in the SQLite database.
Uses the same bcrypt hash as the backend (rounds=12).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext
import sqlite3

# ── New credentials ───────────────────────────────────────────────
NEW_USERNAME = "admin"
NEW_EMAIL = "admin@visionattend.local"
NEW_PASSWORD = "VisionAdmin@2026"
NEW_ROLE = "admin"
NEW_IS_ADMIN = 1
# ─────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
hashed = pwd_context.hash(NEW_PASSWORD)

conn = sqlite3.connect("attendance.db")
cur = conn.cursor()

cur.execute(
    """
    UPDATE users
    SET username        = ?,
        email           = ?,
        hashed_password = ?,
        role            = ?,
        is_admin        = ?
    WHERE id = 1
""",
    (NEW_USERNAME, NEW_EMAIL, hashed, NEW_ROLE, NEW_IS_ADMIN),
)

conn.commit()
affected = cur.rowcount
conn.close()

if affected == 0:
    print("ERROR: No user with id=1 found.")
else:
    print("=" * 50)
    print("  Admin credentials updated successfully!")
    print("=" * 50)
    print(f"  Username : {NEW_USERNAME}")
    print(f"  Password : {NEW_PASSWORD}")
    print(f"  Email    : {NEW_EMAIL}")
    print(f"  Role     : {NEW_ROLE}")
    print(f"  is_admin : {bool(NEW_IS_ADMIN)}")
    print("=" * 50)
    print("  Login at: http://localhost:5173/login")
    print("=" * 50)
