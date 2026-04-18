from fastapi import FastAPI, HTTPException
import sqlite3
import hashlib
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

def hash_password(password: str) -> str:
    """Simple SHA-256 hash. For production use bcrypt."""
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,          -- 'admin' | 'hod' | 'faculty' | 'student'
            name TEXT NOT NULL,
            linked_id TEXT               -- faculty_id or student program+semester info
        )
    """)
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_users = [
            ("admin",    hash_password("admin123"),  "admin",   "Administrator", None),
            ("hod",      hash_password("hod123"),    "hod",     "Dr. HOD / Principal", None),
            ("faculty1", hash_password("fac123"),    "faculty", "Dr. Faculty One", "FAC001"),
            ("student1", hash_password("stu123"),    "student", "Student One", "B.Ed.|1"),
        ]
        cursor.executemany(
            "INSERT INTO users (username, password_hash, role, name, linked_id) VALUES (?,?,?,?,?)",
            seed_users
        )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id TEXT UNIQUE,
            name TEXT,
            max_hours INTEGER,
            available_days TEXT DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday'
        )
    """)
    for col, defval in [("available_days", "'Monday,Tuesday,Wednesday,Thursday,Friday'")]:
        try:
            cursor.execute(f"ALTER TABLE faculty ADD COLUMN {col} TEXT DEFAULT {defval}")
        except:
            pass

    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_code TEXT UNIQUE,
            course_name TEXT,
            program TEXT,
            semester TEXT,
            theory_hours INTEGER DEFAULT 3,
            practical_hours INTEGER DEFAULT 0
        )
    """)
    for col, defval in [("theory_hours", "3"), ("practical_hours", "0"), ("semester", "'1'")]:
        try:
            cursor.execute(f"ALTER TABLE courses ADD COLUMN {col} INTEGER DEFAULT {defval}")
        except:
            pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT UNIQUE,
            room_type TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_faculty (
            course_code TEXT,
            faculty_id TEXT,
            PRIMARY KEY (course_code, faculty_id)
        )
    """)

    conn.commit()
    conn.close()

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

class NewUserRequest(BaseModel):
    username: str
    password: str
    role: str
    name: str
    linked_id: Optional[str] = None

class Course(BaseModel):
    code: str
    name: str
    program: str
    semester: str
    theoryHours: int = 3
    practicalHours: int = 0

class Faculty(BaseModel):
    id: str
    name: str
    maxHours: int = 10
    availableDays: Optional[List[str]] = ["Monday","Tuesday","Wednesday","Thursday","Friday"]

class Room(BaseModel):
    number: str
    type: str

class TimetableRequest(BaseModel):
    courses: List[Course]
    faculty: List[Faculty]
    rooms: List[Room]
    program: str
    semester: str

LAB_TYPES = {"laboratory", "lab", "computer lab", "science lab"}

def is_lab_room(room: Room) -> bool:
    return room.type.strip().lower() in LAB_TYPES

def is_classroom(room: Room) -> bool:
    return not is_lab_room(room)

@app.post("/login")
def login(data: LoginRequest):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, role, name, linked_id FROM users WHERE username=? AND password_hash=?",
        (data.username, hash_password(data.password))
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return {
        "username":  row[0],
        "role":      row[1],   
        "name":      row[2],
        "linked_id": row[3]    
    }

@app.get("/users")
def get_users():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, name, linked_id FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [{"id":r[0], "username":r[1], "role":r[2], "name":r[3], "linked_id":r[4]} for r in rows]

@app.post("/add-user")
def add_user(data: NewUserRequest):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role, name, linked_id) VALUES (?,?,?,?,?)",
            (data.username, hash_password(data.password), data.role, data.name, data.linked_id)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists.")
    conn.close()
    return {"message": "User created"}

@app.delete("/delete-user/{user_id}")
def delete_user(user_id: int):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    return {"message": "User deleted"}

@app.post("/add-faculty")
def add_faculty(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    available_days = ",".join(
        data.get("availableDays", ["Monday","Tuesday","Wednesday","Thursday","Friday"])
    )
    cursor.execute(
        """INSERT INTO faculty (faculty_id, name, max_hours, available_days)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(faculty_id) DO UPDATE SET
             name=excluded.name,
             max_hours=excluded.max_hours,
             available_days=excluded.available_days""",
        (data["id"], data["name"], data.get("maxHours", 10), available_days)
    )
    conn.commit()
    conn.close()
    return {"message": "Faculty saved"}

@app.get("/faculty")
def get_faculty():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("SELECT faculty_id, name, max_hours, available_days FROM faculty")
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "name": r[1], "maxHours": r[2],
            "availableDays": r[3].split(",") if r[3] else
                             ["Monday","Tuesday","Wednesday","Thursday","Friday"]
        }
        for r in rows
    ]

@app.delete("/delete-faculty/{faculty_id}")
def delete_faculty(faculty_id: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM faculty WHERE faculty_id = ?", (faculty_id,))
    conn.commit()
    conn.close()
    return {"message": "Faculty deleted"}

@app.post("/add-course")
def add_course(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO courses (course_code, course_name, program, semester, theory_hours, practical_hours)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(course_code) DO UPDATE SET
             course_name=excluded.course_name,
             program=excluded.program,
             semester=excluded.semester,
             theory_hours=excluded.theory_hours,
             practical_hours=excluded.practical_hours""",
        (
            data["code"], data["name"], data["program"],
            data.get("semester", "1"),
            int(data.get("theoryHours", 3)),
            int(data.get("practicalHours", 0))
        )
    )
    conn.commit()
    conn.close()
    return {"message": "Course saved"}

@app.get("/courses")
def get_courses():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute(
        "SELECT course_code, course_name, program, semester, theory_hours, practical_hours FROM courses"
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "code": r[0], "name": r[1], "program": r[2], "semester": r[3],
            "theoryHours": r[4] if r[4] is not None else 3,
            "practicalHours": r[5] if r[5] is not None else 0
        }
        for r in rows
    ]

@app.delete("/delete-course/{code}")
def delete_course(code: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM courses WHERE course_code = ?", (code,))
    cursor.execute("DELETE FROM course_faculty WHERE course_code = ?", (code,))
    conn.commit()
    conn.close()
    return {"message": "Course deleted"}

@app.post("/assign-faculty")
def assign_faculty(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR IGNORE INTO course_faculty (course_code, faculty_id) VALUES (?, ?)",
        (data["course_code"], data["faculty_id"])
    )
    conn.commit()
    conn.close()
    return {"message": "Assigned successfully"}

@app.get("/course-faculty/{course_code}")
def get_course_faculty(course_code: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("SELECT faculty_id FROM course_faculty WHERE course_code=?", (course_code,))
    rows = cursor.fetchall()
    conn.close()
    return {"faculty_ids": [r[0] for r in rows]}

@app.post("/add-room")
def add_room(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO rooms (room_number, room_type) VALUES (?, ?)
           ON CONFLICT(room_number) DO UPDATE SET room_type=excluded.room_type""",
        (data["number"], data["type"])
    )
    conn.commit()
    conn.close()
    return {"message": "Room saved"}

@app.get("/rooms")
def get_rooms():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("SELECT room_number, room_type FROM rooms")
    rows = cursor.fetchall()
    conn.close()
    return [{"number": r[0], "type": r[1]} for r in rows]

@app.delete("/delete-room/{room_number}")
def delete_room(room_number: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rooms WHERE room_number = ?", (room_number,))
    conn.commit()
    conn.close()
    return {"message": "Room deleted"}

@app.post("/generate")
def generate_timetable(data: TimetableRequest):

    ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    THEORY_SLOTS = [
        "09:00-09:50",
        "09:50-10:40",
        "10:50-11:40",
        "11:40-12:30",
        "13:30-14:20",
        "14:20-15:10",
        "15:20-16:10"
    ]

    LAB_PAIRS = [(0, 1), (2, 3), (4, 5)]

    lab_rooms   = [r for r in data.rooms if is_lab_room(r)]
    class_rooms = [r for r in data.rooms if is_classroom(r)]

    warnings = []

    if not lab_rooms:
        warnings.append(
            "No Laboratory rooms found. Add rooms with type 'Laboratory' for practical courses."
        )
    if not class_rooms:
        warnings.append(
            "No Classroom rooms found. Add rooms with type 'Classroom' for theory courses."
        )

    timetable = {day: {slot: None for slot in THEORY_SLOTS} for day in ALL_DAYS}
    faculty_map = {f.id: f for f in data.faculty}

    filtered_courses = [
        c for c in data.courses
        if (data.program == "All Programs" or c.program == data.program)
        and str(c.semester) == str(data.semester)
    ]

    if not filtered_courses:
        return {
            "timetable": timetable,
            "warnings": warnings + ["No courses found for the selected program/semester."]
        }

    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    course_faculty_map: dict = {}
    for course in filtered_courses:
        cursor.execute(
            "SELECT faculty_id FROM course_faculty WHERE course_code=?", (course.code,)
        )
        fids     = [row[0] for row in cursor.fetchall()]
        assigned = [faculty_map[fid] for fid in fids if fid in faculty_map]
        if assigned:
            course_faculty_map[course.code] = assigned[0]
        else:
            warnings.append(f"No faculty assigned to {course.code} — skipped.")

    conn.close()

    faculty_hours: dict = {f.id: 0 for f in data.faculty}
    faculty_busy:  dict = {f.id: {day: set() for day in ALL_DAYS} for f in data.faculty}
    room_busy:     dict = {r.number: {day: set() for day in ALL_DAYS} for r in data.rooms}

    def pick_room(pool: list, day: str, slot: str, extra_slot: str = None):
        sorted_pool = sorted(pool, key=lambda r: len(room_busy[r.number][day]))
        for r in sorted_pool:
            busy = room_busy[r.number][day]
            if slot in busy:
                continue
            if extra_slot and extra_slot in busy:
                continue
            return r
        return None

    def place(day, slot, course, fac, room, kind):
        timetable[day][slot] = {
            "course": course.code, "name": course.name,
            "faculty": fac.name,  "room": room.number, "type": kind
        }
        faculty_busy[fac.id][day].add(slot)
        room_busy[room.number][day].add(slot)
        faculty_hours[fac.id] += 1

    for course in filtered_courses:
        if course.practicalHours <= 0:
            continue
        fac = course_faculty_map.get(course.code)
        if not fac or not lab_rooms:
            if not lab_rooms:
                warnings.append(f"Skipped lab for {course.code}: no Laboratory rooms.")
            continue

        sessions_needed = max(1, course.practicalHours // 2)
        placed_labs     = 0
        fac_days        = list(getattr(fac, "availableDays", None) or ALL_DAYS)

        for day in ALL_DAYS:
            if placed_labs >= sessions_needed:
                break
            if day not in fac_days:
                continue
            if faculty_hours[fac.id] + 2 > fac.maxHours:
                warnings.append(f"{fac.name} hit max hours — lab for {course.code} skipped.")
                break

            for (i1, i2) in LAB_PAIRS:
                s1, s2 = THEORY_SLOTS[i1], THEORY_SLOTS[i2]
                if s1 in faculty_busy[fac.id][day] or s2 in faculty_busy[fac.id][day]:
                    continue
                if timetable[day][s1] or timetable[day][s2]:
                    continue
                room = pick_room(lab_rooms, day, s1, extra_slot=s2)
                if room is None:
                    continue
                place(day, s1, course, fac, room, "Lab")
                place(day, s2, course, fac, room, "Lab (contd.)")
                placed_labs += 1
                break

        if placed_labs < sessions_needed:
            warnings.append(
                f"Only placed {placed_labs}/{sessions_needed} lab session(s) for {course.code}."
            )
    for course in filtered_courses:
        if course.theoryHours <= 0:
            continue
        fac = course_faculty_map.get(course.code)
        if not fac or not class_rooms:
            if not class_rooms:
                warnings.append(f"Skipped theory for {course.code}: no Classroom rooms.")
            continue

        fac_days       = [d for d in ALL_DAYS if d in (getattr(fac, "availableDays", None) or ALL_DAYS)]
        hours_to_place = course.theoryHours
        placed         = 0

        if not fac_days:
            warnings.append(f"{fac.name} has no available days — theory for {course.code} skipped.")
            continue

        day_cycle = list(fac_days)

        for _ in range(len(fac_days) * len(THEORY_SLOTS) * 3):
            if placed >= hours_to_place or not day_cycle:
                break

            day = day_cycle[0]

            if faculty_hours[fac.id] + 1 > fac.maxHours:
                warnings.append(f"{fac.name} hit max hours — theory for {course.code} skipped.")
                break

            already_today = any(
                timetable[day][sl] is not None
                and timetable[day][sl]["course"] == course.code
                and timetable[day][sl]["type"] == "Theory"
                for sl in THEORY_SLOTS
            )
            if already_today:
                day_cycle = day_cycle[1:] + [day_cycle[0]]
                continue

            slot_placed = False
            for slot in THEORY_SLOTS:
                if timetable[day][slot] is not None:
                    continue
                if slot in faculty_busy[fac.id][day]:
                    continue
                room = pick_room(class_rooms, day, slot)
                if room is None:
                    continue
                place(day, slot, course, fac, room, "Theory")
                placed += 1
                slot_placed = True
                day_cycle = day_cycle[1:] + [day_cycle[0]]
                break

            if not slot_placed:
                day_cycle = day_cycle[1:] + [day_cycle[0]]

        if placed < hours_to_place:
            warnings.append(
                f"Only placed {placed}/{hours_to_place} theory slot(s) for {course.code}."
            )

    return {"timetable": timetable, "warnings": warnings}
