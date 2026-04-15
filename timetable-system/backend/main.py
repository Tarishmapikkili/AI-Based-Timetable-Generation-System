from fastapi import FastAPI
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()
def init_db():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
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
@app.post("/add-faculty")
def add_faculty(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    available_days = ",".join(data.get("availableDays", ["Monday","Tuesday","Wednesday","Thursday","Friday"]))
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
            "id": r[0],
            "name": r[1],
            "maxHours": r[2],
            "availableDays": r[3].split(",") if r[3] else ["Monday","Tuesday","Wednesday","Thursday","Friday"]
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

# ================= COURSE APIs =================

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
            data["code"],
            data["name"],
            data["program"],
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
    cursor.execute("SELECT course_code, course_name, program, semester, theory_hours, practical_hours FROM courses")
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "code": r[0],
            "name": r[1],
            "program": r[2],
            "semester": r[3],
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

# ================= ROOM APIs =================

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

# ================= TIMETABLE GENERATION =================

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
    timetable = {day: {slot: None for slot in THEORY_SLOTS} for day in ALL_DAYS}
    faculty_map = {f.id: f for f in data.faculty}
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    filtered_courses = [
        c for c in data.courses
        if (data.program == "All Programs" or c.program == data.program)
        and str(c.semester) == str(data.semester)
    ]

    if not filtered_courses:
        conn.close()
        return {"timetable": timetable, "warnings": ["No courses found for selected program/semester"]}

    warnings = []
    course_faculty_map = {}
    for course in filtered_courses:
        cursor.execute("SELECT faculty_id FROM course_faculty WHERE course_code=?", (course.code,))
        fids = [row[0] for row in cursor.fetchall()]
        assigned = [faculty_map[fid] for fid in fids if fid in faculty_map]
        if assigned:
            course_faculty_map[course.code] = assigned[0]
        else:
            warnings.append(f"No faculty assigned to {course.code} — skipped")

    conn.close()
    faculty_hours = {f.id: 0 for f in data.faculty}
    faculty_busy = {f.id: {day: set() for day in ALL_DAYS} for f in data.faculty}

    lab_rooms = [r for r in data.rooms if r.type.lower() in ("laboratory", "lab")]
    class_rooms = [r for r in data.rooms if r.type.lower() not in ("laboratory", "lab")]
    if not class_rooms:
        class_rooms = data.rooms  
    if not lab_rooms:
        lab_rooms = data.rooms   

    room_busy = {}  
    for r in data.rooms:
        room_busy[r.number] = {day: set() for day in ALL_DAYS}

    def find_free_room(rooms_list, day, slot):
        for r in rooms_list:
            if slot not in room_busy[r.number][day]:
                return r
        return None

    def place_slot(day, slot, course, fac, room, slot_type):
        timetable[day][slot] = {
            "course": course.code,
            "name": course.name,
            "faculty": fac.name,
            "room": room.number,
            "type": slot_type
        }
        faculty_busy[fac.id][day].add(slot)
        room_busy[room.number][day].add(slot)
        faculty_hours[fac.id] += 1

    
    for course in filtered_courses:
        if course.practicalHours <= 0:
            continue

        fac = course_faculty_map.get(course.code)
        if not fac:
            continue

        lab_sessions_needed = course.practicalHours // 2  

        placed_labs = 0
        for day in ALL_DAYS:
            if placed_labs >= lab_sessions_needed:
                break
            if hasattr(fac, 'availableDays') and fac.availableDays and day not in fac.availableDays:
                continue
            if faculty_hours[fac.id] + 2 > fac.maxHours:
                warnings.append(f"{fac.name} reached max hours — lab for {course.code} skipped")
                break

            for (s1_idx, s2_idx) in LAB_PAIRS:
                slot1 = THEORY_SLOTS[s1_idx]
                slot2 = THEORY_SLOTS[s2_idx]
                if slot1 in faculty_busy[fac.id][day] or slot2 in faculty_busy[fac.id][day]:
                    continue
                if timetable[day][slot1] is not None or timetable[day][slot2] is not None:
                    continue

                room = find_free_room(lab_rooms, day, slot1)
                if room is None or slot2 in room_busy[room.number][day]:
                    continue

                place_slot(day, slot1, course, fac, room, "Lab")
                place_slot(day, slot2, course, fac, room, "Lab (contd.)")
                placed_labs += 1
                break

        if placed_labs < lab_sessions_needed:
            warnings.append(f"Could only place {placed_labs}/{lab_sessions_needed} lab sessions for {course.code}")

    for course in filtered_courses:
        if course.theoryHours <= 0:
            continue

        fac = course_faculty_map.get(course.code)
        if not fac:
            continue

        hours_to_place = course.theoryHours
        placed = 0
        day_order = list(ALL_DAYS)

        for attempt in range(len(ALL_DAYS) * len(THEORY_SLOTS)):
            if placed >= hours_to_place:
                break

            day = day_order[placed % len(day_order)]

            
            if hasattr(fac, 'availableDays') and fac.availableDays and day not in fac.availableDays:
                
                day_order = [d for d in day_order if d != day]
                if not day_order:
                    break
                continue

            
            if faculty_hours[fac.id] + 1 > fac.maxHours:
                warnings.append(f"{fac.name} reached max hours — theory slot for {course.code} skipped")
                break

            
            course_already_today = any(
                timetable[day][sl] and timetable[day][sl]["course"] == course.code
                and timetable[day][sl]["type"] == "Theory"
                for sl in THEORY_SLOTS
            )
            if course_already_today:
                
                day_order = day_order[1:] + [day_order[0]]
                continue

            
            slot_placed = False
            for slot in THEORY_SLOTS:
                if timetable[day][slot] is not None:
                    continue
                if slot in faculty_busy[fac.id][day]:
                    continue

                room = find_free_room(class_rooms, day, slot)
                if room is None:
                    continue

                place_slot(day, slot, course, fac, room, "Theory")
                placed += 1
                slot_placed = True
                day_order = day_order[1:] + [day_order[0]]
                break

            if not slot_placed:
                day_order = day_order[1:] + [day_order[0]]

        if placed < hours_to_place:
            warnings.append(f"Could only place {placed}/{hours_to_place} theory slots for {course.code}")

    return {"timetable": timetable, "warnings": warnings}
