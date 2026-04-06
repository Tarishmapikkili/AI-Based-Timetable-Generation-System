console.log("✅ app.js loaded");
let courses = [];
let faculty = [];
let rooms = [];
let students = [];
let generatedTimetable = null;
function updateDashboard() {
    document.getElementById("totalCourses").innerText = courses.length;
    document.getElementById("totalFaculty").innerText = faculty.length;
    document.getElementById("totalStudents").innerText = students.length;
    document.getElementById("totalRooms").innerText = rooms.length;
}

function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach(sec =>
        sec.classList.remove("active")
    );
    document.getElementById(sectionId).classList.add("active");
}

function openAddCourseModal() {
    document.getElementById("courseModal").classList.add("active");
}

function openAddFacultyModal() {
    document.getElementById("facultyModal").classList.add("active");
}

function openAddRoomModal() {
    document.getElementById("roomModal").classList.add("active");
}

function openAddStudentModal() {
    document.getElementById("studentModal").classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

function renderCourses() {
    const list = document.getElementById("coursesList");
    list.innerHTML = "";

    courses.forEach(c => {
        list.innerHTML += `
            <div class="list-item">
                ${c.code} - ${c.name} (${c.program})
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="deleteCourse('${c.code}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderFaculty() {
    const list = document.getElementById("facultyList");
    list.innerHTML = "";

    faculty.forEach(f => {
        list.innerHTML += `
            <div class="list-item">
                ${f.id} - ${f.name}
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="deleteFaculty('${f.id}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderRooms() {
    const list = document.getElementById("roomsList");
    list.innerHTML = "";

    rooms.forEach(r => {
        list.innerHTML += `
            <div class="list-item">
                ${r.number} (${r.type})
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="deleteRoom('${r.number}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderStudents() {
    const list = document.getElementById("studentsList");
    list.innerHTML = "";
    students.forEach(s => {
        list.innerHTML += `
            <div class="list-item">
                ${s.id} - ${s.name} (${s.program})
            </div>
        `;
    });
}


async function saveCourse() {

    const theoryHours = parseInt(document.getElementById("theoryHours").value) || 0;
    const practicalHours = parseInt(document.getElementById("practicalHours").value) || 0;

    const newCourse = {
    code: document.getElementById("courseCode").value,
    name: document.getElementById("courseName").value,
    program: document.getElementById("courseProgram").value,
    semester: document.getElementById("courseSemester").value,
    isPractical: practicalHours > 0
};

    await fetch("http://127.0.0.1:8000/add-course", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(newCourse)
    });

    alert("Course saved to database!");

    closeModal("courseModal");
    loadCoursesFromDB();
}
async function loadCoursesFromDB() {

    const response = await fetch("http://127.0.0.1:8000/courses");
    const data = await response.json();

    courses = data;
    renderCourses();
    updateDashboard();
}

async function saveFaculty() {

    const newFaculty = {
        id: document.getElementById("facultyId").value,
        name: document.getElementById("facultyName").value,
        maxHours: parseInt(document.getElementById("facultyMaxHours").value) || 10
    };

    await fetch("http://127.0.0.1:8000/add-faculty", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(newFaculty)
    });

    alert("Faculty saved to database!");

    closeModal("facultyModal");

    loadFacultyFromDB();  
}
async function loadFacultyFromDB() {

    const response = await fetch("http://127.0.0.1:8000/faculty");
    const data = await response.json();

    faculty = data;

    renderFaculty();
    updateDashboard();
}

async function saveRoom() {

    const newRoom = {
        number: document.getElementById("roomNumber").value,
        type: document.getElementById("roomType").value
    };

    await fetch("http://127.0.0.1:8000/add-room", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(newRoom)
    });

    alert("Room saved to database!");

    closeModal("roomModal");
    loadRoomsFromDB();
}
async function loadRoomsFromDB() {

    const response = await fetch("http://127.0.0.1:8000/rooms");
    const data = await response.json();

    rooms = data;
    renderRooms();
    updateDashboard();
}

function saveStudent() {
    students.push({
        id: document.getElementById("studentId").value,
        name: document.getElementById("studentName").value,
        program: document.getElementById("studentProgram").value
    });

    renderStudents();
    updateDashboard();
    closeModal("studentModal");
}
function displayTimetable() {
    if (!generatedTimetable) return;

    let html = "<table class='timetable'><tr><th>Time</th>";

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    days.forEach(day => html += `<th>${day}</th>`);
    html += "</tr>";

    slots.forEach((slot, index) => {
        if (index === 2) {
            html += `
                <tr style="background:#ffeaa7; font-weight:bold;">
                    <td colspan="${days.length + 1}">
                        ☕ Break (11:00 - 11:10)
                    </td>
                </tr>
            `;
        }
        if (index === 3) {
            html += `
                <tr style="background:#fab1a0; font-weight:bold;">
                    <td colspan="${days.length + 1}">
                        🍽 Lunch Break (12:10 - 01:10)
                    </td>
                </tr>
            `;
        }

        html += `<tr><td>${slot}</td>`;

        days.forEach(day => {
            const cell = generatedTimetable[day][slot];

            html += `
                <td class="timetable-cell ${cell ? 'occupied' : ''}">
                    ${cell ? `
                        <div class="class-info">
                            <div class="class-code">${cell.course}</div>
                            <div>${cell.name}</div>
                            <div class="class-faculty">${cell.faculty}</div>
                            <div>${cell.room}</div>
                        </div>
                    ` : ""}
                </td>
            `;
        });

        html += "</tr>";
    });

    html += "</table>";
    document.getElementById("timetableDisplay").innerHTML = html;
}


async function generateTimetable() {

    const selectedProgram = document.getElementById("program").value;
    const selectedSemester = document.getElementById("semester").value.replace("Semester ", "");


    if (faculty.length === 0) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-warning">
                ⚠️ Please add faculty before generating timetable.
            </div>
        `;
        showSection("view");
        return;
    }

    if (rooms.length === 0) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-warning">
                ⚠️ Please add rooms before generating timetable.
            </div>
        `;
        showSection("view");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                courses: courses,
                faculty: faculty,
                rooms: rooms,
                program: selectedProgram,
                semester: selectedSemester
            })
        });

        const result = await response.json();
        let hasData = false;

        for (let day in result.timetable) {
            for (let slot in result.timetable[day]) {
                if (result.timetable[day][slot] !== null) {
                    hasData = true;
                    break;
                }
            }
        }

        if (!hasData) {
            document.getElementById("timetableDisplay").innerHTML = `
                <div class="alert alert-warning">
                    ⚠️ No timetable available for selected program & semester.
                </div>
            `;
            showSection("view");
            return;
        }
        generatedTimetable = result.timetable;
        displayTimetable();
        showSection("view");

    } catch (error) {
        alert("Backend not running. Please start FastAPI server.");
        console.error(error);
    }
}
function filterTimetable() {

    if (!generatedTimetable) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-info">
                📅 Generate timetable first
            </div>
        `;
        return;
    }

    const selectedProgram = document.getElementById("filterProgram").value;

    const filteredCourses = courses.filter(c =>
        selectedProgram === "All Programs" || c.program === selectedProgram
    );

    if (filteredCourses.length === 0) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-warning">
                ⚠️ No courses available for ${selectedProgram}
            </div>
        `;
        return;
    }
    if (faculty.length === 0 || rooms.length === 0) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-warning">
                ⚠️ Please add faculty and rooms before generating timetable
            </div>
        `;
        return;
    }
    displayTimetable();
}
async function deleteCourse(code) {

    if (!confirm("Are you sure you want to delete this course?")) return;

    await fetch(`http://127.0.0.1:8000/delete-course/${code}`, {
        method: "DELETE"
    });

    alert("Course deleted!");

    loadCoursesFromDB();
}
async function deleteFaculty(id) {

    if (!confirm("Delete this faculty?")) return;

    await fetch(`http://127.0.0.1:8000/delete-faculty/${id}`, {
        method: "DELETE"
    });

    alert("Faculty deleted!");

    loadFacultyFromDB();
}
async function deleteRoom(number) {

    if (!confirm("Delete this room?")) return;

    await fetch(`http://127.0.0.1:8000/delete-room/${number}`, {
        method: "DELETE"
    });

    alert("Room deleted!");

    loadRoomsFromDB();
}
function exportToPDF() {

    if (!generatedTimetable) {
        alert("Generate timetable first!");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    const tableColumn = ["Time", ...days];

    const tableRows = [];

    slots.forEach((slot, index) => {

        if (index === 2) {
            tableRows.push([
    { content: "BREAK (11:00 - 11:10)", colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fontSize: 12, fillColor: [240, 240, 240] } }
]);
        }

        if (index === 3) {
            tableRows.push([
    { content: "LUNCH (12:10 - 01:10)", colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fontSize: 12, fillColor: [220, 220, 220] } }
]);
        }

        let row = [convertTo12Hour(slot)];

        days.forEach(day => {
            const cell = generatedTimetable[day][slot];

            if (cell) {
                row.push(
                    `${cell.course}\n${cell.name}\n${cell.faculty}\nRoom: ${cell.room}`
                );
            } else {
                row.push("-");
            }
        });

        tableRows.push(row);
    });

    doc.setFontSize(16);
    doc.text("Weekly Timetable", 14, 15);
    doc.autoTable({
        startY: 20,
        head: [tableColumn],
        body: tableRows,
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        headStyles: {
            fillColor: [41, 128, 185]
        },
        columnStyles: {
            0: { cellWidth: 30 } 
        }
    });

    doc.save("timetable.pdf");
}
function convertTo12Hour(timeRange) {

    function convert(time) {
        let [hours, minutes] = time.split(":");
        hours = parseInt(hours);

        let period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;

        return `${hours.toString().padStart(2, "0")}:${minutes} ${period}`;
    }

    const [start, end] = timeRange.split("-");
    return `${convert(start)} - ${convert(end)}`;
}
window.onload = function() {
    loadFacultyFromDB();
    loadCoursesFromDB();
    loadRoomsFromDB();
};
