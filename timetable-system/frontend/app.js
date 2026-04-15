console.log("✅ app.js loaded");
let courses = [];
let faculty = [];
let rooms = [];
let students = [];
let generatedTimetable = null;

const API = "http://127.0.0.1:8000";


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
    document.querySelectorAll(".nav-tab").forEach(tab =>
        tab.classList.remove("active")
    );
    document.getElementById(sectionId).classList.add("active");
    const tabIndex = ["dashboard","courses","faculty","students","infrastructure","generate","view"];
    const idx = tabIndex.indexOf(sectionId);
    if (idx !== -1) {
        document.querySelectorAll(".nav-tab")[idx].classList.add("active");
    }
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
    if (courses.length === 0) {
        list.innerHTML = `<div class="alert alert-info">No courses added yet.</div>`;
        return;
    }
    courses.forEach(c => {
        list.innerHTML += `
            <div class="list-item">
                <div>
                    <strong>${c.code}</strong> — ${c.name}
                    <span class="badge badge-success" style="margin-left:8px">${c.program}</span>
                    <span class="badge badge-warning" style="margin-left:4px">Sem ${c.semester}</span>
                    <br>
                    <small style="color:var(--text-secondary)">
                        Theory: ${c.theoryHours}h/wk &nbsp;|&nbsp; Practical: ${c.practicalHours}h/wk
                    </small>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" title="Delete" onclick="deleteCourse('${c.code}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderFaculty() {
    const list = document.getElementById("facultyList");
    list.innerHTML = "";
    if (faculty.length === 0) {
        list.innerHTML = `<div class="alert alert-info">No faculty added yet.</div>`;
        return;
    }
    faculty.forEach(f => {
        const days = (f.availableDays || []).join(", ") || "All days";
        list.innerHTML += `
            <div class="list-item">
                <div>
                    <strong>${f.id}</strong> — ${f.name}
                    <br>
                    <small style="color:var(--text-secondary)">
                        Max ${f.maxHours}h/wk &nbsp;|&nbsp; Available: ${days}
                    </small>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" title="Delete" onclick="deleteFaculty('${f.id}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderRooms() {
    const list = document.getElementById("roomsList");
    list.innerHTML = "";
    if (rooms.length === 0) {
        list.innerHTML = `<div class="alert alert-info">No rooms added yet.</div>`;
        return;
    }
    rooms.forEach(r => {
        list.innerHTML += `
            <div class="list-item">
                <div>
                    <strong>${r.number}</strong>
                    <span class="badge badge-success" style="margin-left:8px">${r.type}</span>
                </div>
                <div class="list-item-actions">
                    <button class="btn-icon" title="Delete" onclick="deleteRoom('${r.number}')">❌</button>
                </div>
            </div>
        `;
    });
}

function renderStudents() {
    const list = document.getElementById("studentsList");
    list.innerHTML = "";
    if (students.length === 0) {
        list.innerHTML = `<div class="alert alert-info">No students added yet.</div>`;
        return;
    }
    students.forEach(s => {
        list.innerHTML += `
            <div class="list-item">
                <strong>${s.id}</strong> — ${s.name}
                <span class="badge badge-success" style="margin-left:8px">${s.program}</span>
                <span class="badge badge-warning" style="margin-left:4px">Sem ${s.semester}</span>
            </div>
        `;
    });
}

async function saveCourse() {
    const code = document.getElementById("courseCode").value.trim();
    const name = document.getElementById("courseName").value.trim();
    const program = document.getElementById("courseProgram").value;
    const semester = document.getElementById("courseSemester").value;
    const theoryHours = parseInt(document.getElementById("theoryHours").value) || 0;
    const practicalHours = parseInt(document.getElementById("practicalHours").value) || 0;

    if (!code || !name) {
        alert("Please fill in Course Code and Course Name.");
        return;
    }

    const newCourse = { code, name, program, semester, theoryHours, practicalHours };

    try {
        const res = await fetch(`${API}/add-course`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newCourse)
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal("courseModal");
        // Clear fields
        ["courseCode","courseName","theoryHours","practicalHours"].forEach(id =>
            document.getElementById(id).value = ""
        );
        await loadCoursesFromDB();
    } catch (e) {
        alert("Error saving course: " + e.message);
    }
}

async function loadCoursesFromDB() {
    try {
        const response = await fetch(`${API}/courses`);
        courses = await response.json();
        renderCourses();
        updateDashboard();
        loadAssignDropdowns();
    } catch (e) {
        console.error("Could not load courses:", e);
    }
}

async function saveFaculty() {
    const id = document.getElementById("facultyId").value.trim();
    const name = document.getElementById("facultyName").value.trim();
    const maxHours = parseInt(document.getElementById("facultyMaxHours").value) || 10;

    if (!id || !name) {
        alert("Please fill in Faculty ID and Name.");
        return;
    }
    const dayCheckboxes = document.querySelectorAll('#facultyModal input[type="checkbox"]');
    const availableDays = Array.from(dayCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (availableDays.length === 0) {
        alert("Please select at least one available day.");
        return;
    }

    const newFaculty = { id, name, maxHours, availableDays };

    try {
        const res = await fetch(`${API}/add-faculty`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newFaculty)
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal("facultyModal");
        ["facultyId","facultyName","facultyEmail","facultyDept","facultyMaxHours","facultySpec"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
        
        dayCheckboxes.forEach(cb => cb.checked = true);
        await loadFacultyFromDB();
    } catch (e) {
        alert("Error saving faculty: " + e.message);
    }
}

async function loadFacultyFromDB() {
    try {
        const response = await fetch(`${API}/faculty`);
        faculty = await response.json();
        renderFaculty();
        updateDashboard();
        loadAssignDropdowns();
    } catch (e) {
        console.error("Could not load faculty:", e);
    }
}

async function saveRoom() {
    const number = document.getElementById("roomNumber").value.trim();
    const type = document.getElementById("roomType").value;

    if (!number) {
        alert("Please enter a room number.");
        return;
    }

    const newRoom = { number, type };

    try {
        const res = await fetch(`${API}/add-room`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRoom)
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal("roomModal");
        document.getElementById("roomNumber").value = "";
        await loadRoomsFromDB();
    } catch (e) {
        alert("Error saving room: " + e.message);
    }
}

async function loadRoomsFromDB() {
    try {
        const response = await fetch(`${API}/rooms`);
        rooms = await response.json();
        renderRooms();
        updateDashboard();
    } catch (e) {
        console.error("Could not load rooms:", e);
    }
}

function saveStudent() {
    const id = document.getElementById("studentId").value.trim();
    const name = document.getElementById("studentName").value.trim();
    const program = document.getElementById("studentProgram").value;
    const semester = document.getElementById("studentSemester").value;

    if (!id || !name) {
        alert("Please fill in Student ID and Name.");
        return;
    }

    students.push({ id, name, program, semester });
    renderStudents();
    updateDashboard();
    closeModal("studentModal");
    ["studentId","studentName","studentEmail","studentCredits"].forEach(sid => {
        const el = document.getElementById(sid);
        if (el) el.value = "";
    });
}

function loadAssignDropdowns() {
    const courseSelect = document.getElementById("assignCourse");
    const facultySelect = document.getElementById("assignFaculty");
    if (!courseSelect || !facultySelect) return;

    courseSelect.innerHTML = courses.length
        ? courses.map(c => `<option value="${c.code}">${c.code} — ${c.name}</option>`).join("")
        : `<option value="">No courses available</option>`;

    facultySelect.innerHTML = faculty.length
        ? faculty.map(f => `<option value="${f.id}">${f.id} — ${f.name}</option>`).join("")
        : `<option value="">No faculty available</option>`;
}

async function assignFacultyToCourse() {
    const courseCode = document.getElementById("assignCourse").value;
    const facultyId = document.getElementById("assignFaculty").value;

    if (!courseCode || !facultyId) {
        alert("Please select both a course and a faculty member.");
        return;
    }

    try {
        const res = await fetch(`${API}/assign-faculty`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_code: courseCode, faculty_id: facultyId })
        });
        if (!res.ok) throw new Error(await res.text());
        alert(`✅ ${facultyId} assigned to ${courseCode}`);
    } catch (e) {
        alert("Error assigning faculty: " + e.message);
    }
}



async function generateTimetable() {
    const selectedProgram = document.getElementById("program").value;
    const semesterRaw = document.getElementById("semester").value;
    const selectedSemester = semesterRaw.replace("Semester ", "");

    const resultDiv = document.getElementById("generationResult");
    resultDiv.innerHTML = "";

    if (faculty.length === 0) {
        resultDiv.innerHTML = `<div class="alert alert-error">⚠️ Please add faculty before generating timetable.</div>`;
        return;
    }
    if (rooms.length === 0) {
        resultDiv.innerHTML = `<div class="alert alert-error">⚠️ Please add rooms before generating timetable.</div>`;
        return;
    }
    const relevantCourses = courses.filter(c =>
        (selectedProgram === "All Programs" || c.program === selectedProgram) &&
        String(c.semester) === String(selectedSemester)
    );

    if (relevantCourses.length === 0) {
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                ⚠️ No courses found for <strong>${selectedProgram}</strong>, Semester <strong>${selectedSemester}</strong>.<br>
                Please add courses with matching program and semester.
            </div>`;
        return;
    }
    document.getElementById("generationProgress").style.display = "block";
    simulateProgress();

    try {
        const response = await fetch(`${API}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                courses,      
                faculty,     
                rooms,
                program: selectedProgram,
                semester: selectedSemester
            })
        });

        const result = await response.json();

        document.getElementById("generationProgress").style.display = "none";
        document.getElementById("progressFill").style.width = "0%";
        let hasData = false;
        for (let day in result.timetable) {
            for (let slot in result.timetable[day]) {
                if (result.timetable[day][slot] !== null) {
                    hasData = true;
                    break;
                }
            }
            if (hasData) break;
        }

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
            resultDiv.innerHTML = result.warnings.map(w =>
                `<div class="alert alert-warning">⚠️ ${w}</div>`
            ).join("");
        }

        if (!hasData) {
            resultDiv.innerHTML += `
                <div class="alert alert-error">
                    ❌ Could not generate timetable. Check that faculty are assigned to courses
                    and faculty availability matches the schedule days.
                </div>`;
            return;
        }

        resultDiv.innerHTML += `<div class="alert alert-success">✅ Timetable generated successfully!</div>`;
        generatedTimetable = result.timetable;
        displayTimetable();

        setTimeout(() => showSection("view"), 800);

    } catch (error) {
        document.getElementById("generationProgress").style.display = "none";
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                ❌ Backend not reachable. Make sure FastAPI is running:<br>
                <code>uvicorn main:app --reload</code>
            </div>`;
        console.error(error);
    }
}

function simulateProgress() {
    const fill = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");
    const steps = [
        [15, "Loading courses & faculty..."],
        [35, "Scheduling lab sessions..."],
        [60, "Distributing theory slots..."],
        [80, "Resolving conflicts..."],
        [95, "Finalizing timetable..."]
    ];
    let i = 0;
    const interval = setInterval(() => {
        if (i >= steps.length) { clearInterval(interval); return; }
        fill.style.width = steps[i][0] + "%";
        label.textContent = steps[i][1];
        i++;
    }, 300);
}

function resetGeneration() {
    generatedTimetable = null;
    document.getElementById("generationResult").innerHTML = "";
    document.getElementById("generationProgress").style.display = "none";
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("timetableDisplay").innerHTML = `
        <div class="alert alert-info"><span>📅</span><div>Generate a timetable first to view it here.</div></div>`;
}

function displayTimetable() {
    if (!generatedTimetable) return;

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);
    const BREAK_AFTER = {
        1: "☕ Short Break (10:40 – 10:50 AM)",
        3: "🍽 Lunch Break (12:30 – 1:30 PM)",
        5: "☕ Short Break (3:10 – 3:20 PM)"
    };

    let html = `<table class='timetable'><thead><tr><th>Time / Day</th>`;
    days.forEach(day => html += `<th>${day}</th>`);
    html += `</tr></thead><tbody>`;

    slots.forEach((slot, index) => {
        html += `<tr><td><strong>${convertTo12Hour(slot)}</strong></td>`;

        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            if (cell) {
                const typeColor = cell.type.startsWith("Lab") ? "#e3f2fd" : "#f0fdf4";
                const typeBadge = cell.type.startsWith("Lab")
                    ? `<span style="background:#1565c0;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">LAB</span>`
                    : `<span style="background:#2e7d32;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem;">THEORY</span>`;
                html += `
                    <td class="timetable-cell occupied" style="background:${typeColor}">
                        <div class="class-info">
                            ${typeBadge}
                            <div class="class-code" style="margin-top:4px">${cell.course}</div>
                            <div style="font-size:0.82rem">${cell.name}</div>
                            <div class="class-faculty">👤 ${cell.faculty}</div>
                            <div class="class-faculty">🚪 ${cell.room}</div>
                        </div>
                    </td>`;
            } else {
                html += `<td class="timetable-cell"></td>`;
            }
        });

        html += `</tr>`;

        if (BREAK_AFTER[index] !== undefined) {
            const bg = index === 3 ? "#fab1a0" : "#ffeaa7";
            html += `
                <tr style="background:${bg}; font-weight:bold; text-align:center;">
                    <td colspan="${days.length + 1}">${BREAK_AFTER[index]}</td>
                </tr>`;
        }
    });

    html += `</tbody></table>`;
    document.getElementById("timetableDisplay").innerHTML = html;

    updateFilterFacultyDropdown();
}

function updateFilterFacultyDropdown() {
    const sel = document.getElementById("filterFaculty");
    if (!sel) return;
    sel.innerHTML = `<option>All Faculty</option>`;
    faculty.forEach(f => {
        sel.innerHTML += `<option value="${f.id}">${f.name}</option>`;
    });
}

function filterTimetable() {
    if (!generatedTimetable) {
        document.getElementById("timetableDisplay").innerHTML = `
            <div class="alert alert-info">📅 Generate timetable first.</div>`;
        return;
    }

    const selectedFaculty = document.getElementById("filterFaculty").value;

    if (selectedFaculty === "All Faculty") {
        displayTimetable();
        return;
    }
    const fac = faculty.find(f => f.id === selectedFaculty);
    const facName = fac ? fac.name : selectedFaculty;
    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    const BREAK_AFTER = {
        1: "☕ Short Break (10:40 – 10:50 AM)",
        3: "🍽 Lunch Break (12:30 – 1:30 PM)",
        5: "☕ Short Break (3:10 – 3:20 PM)"
    };

    let html = `<div class="alert alert-info" style="margin-bottom:1rem">
        📅 Showing timetable for: <strong>${facName}</strong>
    </div>`;
    html += `<table class='timetable'><thead><tr><th>Time / Day</th>`;
    days.forEach(day => html += `<th>${day}</th>`);
    html += `</tr></thead><tbody>`;

    slots.forEach((slot, index) => {
        html += `<tr><td><strong>${convertTo12Hour(slot)}</strong></td>`;

        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            const match = cell && cell.faculty === facName;
            if (match) {
                const typeColor = cell.type.startsWith("Lab") ? "#e3f2fd" : "#f0fdf4";
                html += `
                    <td class="timetable-cell occupied" style="background:${typeColor}">
                        <div class="class-info">
                            <div class="class-code">${cell.course}</div>
                            <div style="font-size:0.82rem">${cell.name}</div>
                            <div class="class-faculty">🚪 ${cell.room}</div>
                            <div class="class-faculty" style="color:#1565c0">${cell.type}</div>
                        </div>
                    </td>`;
            } else {
                html += `<td class="timetable-cell"></td>`;
            }
        });

        html += `</tr>`;

        if (BREAK_AFTER[index] !== undefined) {
            const bg = index === 3 ? "#fab1a0" : "#ffeaa7";
            html += `
                <tr style="background:${bg}; font-weight:bold; text-align:center;">
                    <td colspan="${days.length + 1}">${BREAK_AFTER[index]}</td>
                </tr>`;
        }
    });

    html += `</tbody></table>`;
    document.getElementById("timetableDisplay").innerHTML = html;
}

async function deleteCourse(code) {
    if (!confirm(`Delete course ${code}?`)) return;
    try {
        await fetch(`${API}/delete-course/${encodeURIComponent(code)}`, { method: "DELETE" });
        await loadCoursesFromDB();
    } catch (e) {
        alert("Error deleting course: " + e.message);
    }
}

async function deleteFaculty(id) {
    if (!confirm(`Delete faculty ${id}?`)) return;
    try {
        await fetch(`${API}/delete-faculty/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadFacultyFromDB();
    } catch (e) {
        alert("Error deleting faculty: " + e.message);
    }
}

async function deleteRoom(number) {
    if (!confirm(`Delete room ${number}?`)) return;
    try {
        await fetch(`${API}/delete-room/${encodeURIComponent(number)}`, { method: "DELETE" });
        await loadRoomsFromDB();
    } catch (e) {
        alert("Error deleting room: " + e.message);
    }
}

function exportToPDF() {
    if (!generatedTimetable) { alert("Generate timetable first!"); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    doc.setFontSize(16);
    doc.text("NEP 2020 Weekly Timetable", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = ["Time", ...days];
    const tableRows = [];

    const BREAK_AFTER = {
        1: "☕ SHORT BREAK (10:40 – 10:50 AM)",
        3: "🍽 LUNCH BREAK (12:30 – 1:30 PM)",
        5: "☕ SHORT BREAK (3:10 – 3:20 PM)"
    };

    slots.forEach((slot, index) => {
        let row = [convertTo12Hour(slot)];
        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            row.push(cell
                ? `${cell.course}\n${cell.name}\n${cell.faculty}\nRoom: ${cell.room}\n[${cell.type}]`
                : "—"
            );
        });
        tableRows.push(row);

        if (BREAK_AFTER[index]) {
            tableRows.push([{
                content: BREAK_AFTER[index],
                colSpan: days.length + 1,
                styles: { halign: "center", fontStyle: "bold", fillColor: [240, 230, 140] }
            }]);
        }
    });

    doc.autoTable({
        startY: 27,
        head: [tableColumn],
        body: tableRows,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [26, 35, 50] },
        columnStyles: { 0: { cellWidth: 28 } }
    });

    doc.save("NEP_Timetable.pdf");
}

function exportToExcel() {
    if (!generatedTimetable) { alert("Generate timetable first!"); return; }

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    let data = [["Time", ...days]];

    const BREAK_AFTER = {
        1: "SHORT BREAK (10:40 – 10:50 AM)",
        3: "LUNCH BREAK (12:30 – 1:30 PM)",
        5: "SHORT BREAK (3:10 – 3:20 PM)"
    };

    slots.forEach((slot, index) => {
        let row = [convertTo12Hour(slot)];
        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            row.push(cell
                ? `${cell.course}\n${cell.name}\n${cell.faculty}\nRoom: ${cell.room}\n[${cell.type}]`
                : "—"
            );
        });
        data.push(row);

        if (BREAK_AFTER[index]) {
            data.push([BREAK_AFTER[index], "", "", "", "", ""]);
        }
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 22 }, ...days.map(() => ({ wch: 36 }))];
    ws["!rows"] = data.map(() => ({ hpt: 70 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, "NEP_Timetable.xlsx");
}

function convertTo12Hour(timeRange) {
    function convert(time) {
        let [hours, minutes] = time.split(":");
        hours = parseInt(hours);
        const period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return `${hours.toString().padStart(2, "0")}:${minutes} ${period}`;
    }
    const [start, end] = timeRange.split("-");
    return `${convert(start)} – ${convert(end)}`;
}

window.onload = async function () {
    try {
        await Promise.all([
            loadFacultyFromDB(),
            loadCoursesFromDB(),
            loadRoomsFromDB()
        ]);
        loadAssignDropdowns();
    } catch (e) {
        console.warn("Could not connect to backend on startup:", e.message);
    }
};
