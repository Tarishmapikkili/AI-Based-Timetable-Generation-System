console.log("✅ app.js loaded");

// ================= DATA =================
let courses = [];
let faculty = [];
let rooms = [];
let generatedTimetable = null;

// ================= DASHBOARD =================
function updateDashboard() {
    document.getElementById("totalCourses").innerText = courses.length;
    document.getElementById("totalFaculty").innerText = faculty.length;
    document.getElementById("totalStudents").innerText = 0;
    document.getElementById("totalRooms").innerText = rooms.length;
}

// ================= NAVIGATION =================
function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach(sec =>
        sec.classList.remove("active")
    );
    document.getElementById(sectionId).classList.add("active");
}

// ================= MODALS =================
function openAddCourseModal() {
    document.getElementById("courseModal").classList.add("active");
}
function openAddFacultyModal() {
    document.getElementById("facultyModal").classList.add("active");
}
function openAddRoomModal() {
    document.getElementById("roomModal").classList.add("active");
}
function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

// ================= SAVE =================
function saveCourse() {
    courses.push({
        code: courseCode.value,
        name: courseName.value,
        program: courseProgram.value
    });
    renderCourses();
    updateDashboard();
    closeModal("courseModal");
}

function saveFaculty() {
    faculty.push({
        id: facultyId.value,
        name: facultyName.value
    });
    renderFaculty();
    updateDashboard();
    closeModal("facultyModal");
}

function saveRoom() {
    rooms.push({
        number: roomNumber.value,
        type: roomType.value
    });
    renderRooms();
    updateDashboard();
    closeModal("roomModal");
}

// ================= RENDER =================
function renderCourses() {
    coursesList.innerHTML = "";
    courses.forEach(c => {
        coursesList.innerHTML += `
            <div class="list-item">
                ${c.code} - ${c.name} (${c.program})
            </div>`;
    });
}

function renderFaculty() {
    facultyList.innerHTML = "";
    faculty.forEach(f => {
        facultyList.innerHTML += `
            <div class="list-item">
                ${f.id} - ${f.name}
            </div>`;
    });
}

function renderRooms() {
    roomsList.innerHTML = "";
    rooms.forEach(r => {
        roomsList.innerHTML += `
            <div class="list-item">
                ${r.number} - ${r.type}
            </div>`;
    });
}

// ================= TIMETABLE GENERATION =================
function generateTimetable() {

    const selectedProgram = document.getElementById("program").value;

    // 🔥 CLEAR OLD TIMETABLE COMPLETELY
    generatedTimetable = null;
    document.getElementById("timetableDisplay").innerHTML = "";

    // 🎯 FILTER COURSES PROPERLY
    const filteredCourses = courses.filter(c =>
        selectedProgram === "All Programs" || c.program === selectedProgram
    );

    if (filteredCourses.length === 0) {
        alert(`No courses found for ${selectedProgram}`);
        return;
    }

    if (faculty.length === 0 || rooms.length === 0) {
        alert("Please add faculty and rooms first");
        return;
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const slots = ["09:00-10:00", "10:00-11:00", "11:00-12:00"];

    // 🧠 CREATE BRAND NEW TIMETABLE
    generatedTimetable = {};
    days.forEach(day => {
        generatedTimetable[day] = {};
        slots.forEach(slot => {
            generatedTimetable[day][slot] = "";
        });
    });

    let dayIndex = 0;
    let slotIndex = 0;

    filteredCourses.forEach((course, i) => {

        const day = days[dayIndex];
        const slot = slots[slotIndex];
        const fac = faculty[i % faculty.length];
        const room = rooms[i % rooms.length];

        generatedTimetable[day][slot] = `
            <strong>${course.code}</strong><br>
            ${course.name}<br>
            ${fac.name}<br>
            ${room.number} (${room.type})
        `;

        slotIndex++;
        if (slotIndex >= slots.length) {
            slotIndex = 0;
            dayIndex++;
        }
    });

    displayTimetable();
    showSection("view");
}

// ================= DISPLAY =================
function displayTimetable() {

    let html = "<table class='timetable'><tr><th>Time</th>";

    const days = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);

    days.forEach(day => html += `<th>${day}</th>`);
    html += "</tr>";

    slots.forEach(slot => {
        html += `<tr><td>${slot}</td>`;
        days.forEach(day => {
            html += `
                <td class="timetable-cell occupied">
                    ${generatedTimetable[day][slot]}
                </td>`;
        });
        html += "</tr>";
    });

    html += "</table>";
    timetableDisplay.innerHTML = html;
}
