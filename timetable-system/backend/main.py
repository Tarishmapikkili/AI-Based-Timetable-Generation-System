from fastapi import FastAPI
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

def init_db():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id TEXT,
            name TEXT,
            max_hours INTEGER
        )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT,
        course_name TEXT,
        program TEXT,
        semester TEXT,
        is_practical INTEGER DEFAULT 0
    )
""")
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN is_practical INTEGER DEFAULT 0")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN semester TEXT")
    except:
        pass
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_number TEXT,
            room_type TEXT
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
    isPractical: bool = False

class Faculty(BaseModel):
    id: str
    name: str
    maxHours: int = 10

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

    cursor.execute(
        "INSERT INTO faculty (faculty_id, name, max_hours) VALUES (?, ?, ?)",
        (data["id"], data["name"], data.get("maxHours", 10))
    )

    conn.commit()
    conn.close()
    return {"message": "Faculty saved to database"}

@app.get("/faculty")
def get_faculty():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute("SELECT faculty_id, name, max_hours FROM faculty")
    rows = cursor.fetchall()
    conn.close()

    return [
        {"id": r[0], "name": r[1], "maxHours": r[2]}
        for r in rows
    ]
@app.delete("/delete-faculty/{faculty_id}")
def delete_faculty(faculty_id: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM faculty WHERE faculty_id = ?", (faculty_id,))

    conn.commit()
    conn.close()

    return {"message": "Faculty deleted successfully"}

@app.post("/add-course")
def add_course(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute(
    "INSERT INTO courses (course_code, course_name, program, semester, is_practical) VALUES (?, ?, ?, ?, ?)",
    (
        data["code"],
        data["name"],
        data["program"],
        data.get("semester", "1"),
        1 if data.get("isPractical", False) else 0
    )
)

    conn.commit()
    conn.close()
    return {"message": "Course saved to database"}

@app.get("/courses")
def get_courses():
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute("SELECT course_code, course_name, program, semester, is_practical FROM courses")
    rows = cursor.fetchall()
    conn.close()

    return [
    {
        "code": r[0],
        "name": r[1],
        "program": r[2],
        "semester": r[3],
        "isPractical": bool(r[4])
    }
    for r in rows
]
@app.delete("/delete-course/{code}")
def delete_course(code: str):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute("DELETE FROM courses WHERE course_code = ?", (code,))

    conn.commit()
    conn.close()

    return {"message": "Course deleted successfully"}

@app.post("/add-room")
def add_room(data: dict):
    conn = sqlite3.connect("timetable.db")
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO rooms (room_number, room_type) VALUES (?, ?)",
        (data["number"], data["type"])
    )

    conn.commit()
    conn.close()
    return {"message": "Room saved to database"}

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

    return {"message": "Room deleted successfully"}

@app.post("/generate")
def generate_timetable(data: TimetableRequest):

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    slots = [
        "09:00-10:00",
        "10:00-11:00",
        "11:10-12:10",
        "13:10-14:10",
        "14:20-15:20"
    ]

    timetable = {day: {slot: None for slot in slots} for day in days}

    faculty_workload = {f.name: 0 for f in data.faculty}

    filtered_courses = [
        c for c in data.courses
        if (data.program == "All Programs" or c.program == data.program)
        and (c.semester == data.semester)
    ]

    if not filtered_courses:
        return {"timetable": timetable}

    day_index = 0
    slot_index = 0

    for course in filtered_courses:

        total_sessions = 2 if course.isPractical else 1

        for _ in range(total_sessions):

            assigned = False

            for f in data.faculty:

                if faculty_workload[f.name] >= f.maxHours:
                    continue

                day = days[day_index]
                slot = slots[slot_index]
                if timetable[day][slot] is not None:
                    continue

                room = data.rooms[(day_index + slot_index) % len(data.rooms)]

                timetable[day][slot] = {
                    "course": course.code,
                    "name": course.name,
                    "faculty": f.name,
                    "room": room.number,
                    "type": "Practical" if course.isPractical else "Theory"
                }

                faculty_workload[f.name] += 1
                assigned = True
                break
            slot_index += 1
            if slot_index >= len(slots):
                slot_index = 0
                day_index += 1
                if day_index >= len(days):
                    return {"timetable": timetable}

    return {"timetable": timetable}
