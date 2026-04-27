import sqlite3
conn = sqlite3.connect('attendance.db')
cur = conn.cursor()
cur.execute('SELECT id, username, email, role, is_admin, created_at FROM users ORDER BY id')
rows = cur.fetchall()
print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Role':<10} {'Active':<8} {'Created'}")
print("-" * 90)
for r in rows:
    print(f"{r[0]:<5} {r[1]:<20} {(r[2] or 'N/A'):<30} {r[3]:<10} {str(r[4]):<8} {r[5]}")
print(f"\nTotal: {len(rows)} user(s)")
conn.close()
