"""
Reset all application data directly from the database.
Deletes attendance records, exceptions, undetected faces, training logs, and audit logs.
Users and persons are preserved.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sqlite3

conn = sqlite3.connect("attendance.db")
cur = conn.cursor()

tables_to_clear = [
    "attendance",
    "attendance_exceptions",
    "undetected_faces",
    "training_logs",
    "audit_logs",
]

counts: dict[str, int] = {}

try:
    for table in tables_to_clear:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            counts[table] = count

            cur.execute(f"DELETE FROM {table}")
            print(f"  ✓ {table:25} : {count:6} records deleted")
        except sqlite3.OperationalError as e:
            counts[table] = 0
            print(f"  ✗ {table:25} : Table not found (skipped)")

    conn.commit()
    total_deleted = sum(counts.values())

    print()
    print("=" * 60)
    print("  ALL APPLICATION DATA RESET SUCCESSFULLY")
    print("=" * 60)
    print(f"  Total records deleted: {total_deleted}")
    print("=" * 60)
    print("  Users and persons were preserved.")
    print("=" * 60)

except Exception as e:
    conn.rollback()
    print()
    print("=" * 60)
    print("  ERROR: Failed to reset data")
    print("=" * 60)
    print(f"  {str(e)}")
    print("=" * 60)
    sys.exit(1)
finally:
    conn.close()
