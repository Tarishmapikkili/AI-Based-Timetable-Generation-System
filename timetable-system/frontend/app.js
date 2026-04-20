// ================= INITIAL LOG =================
console.log("✅ app.js loaded");
 
// ================= GLOBAL DATA =================
let courses  = [];
let faculty  = [];
let rooms    = [];
let students = [];
let users    = [];
let generatedTimetable = null;
 
const API = "http://127.0.0.1:8000";
 
// ================= SESSION / AUTH =================
 
let currentUser = null; // { username, role, name, linked_id }
 
function getSession() {
    const raw = sessionStorage.getItem("user");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}
 
function requireLogin() {
    currentUser = getSession();
    if (!currentUser) {
        window.location.href = "login.html";
        return false;
    }
    return true;
}
 
function logout() {
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
}
 
// ── Role permission helpers ──────────────────────────────────────────────────
// admin  → everything
// hod    → view timetable, view courses/faculty/rooms (read-only), no generate
// faculty→ view timetable only (filtered to their name)
// student→ view timetable only (filtered to their program+semester)
 
const ROLE_TABS = {
    admin:   ["dashboard","courses","faculty","students","infrastructure","generate","view","userMgmt"],
    hod:     ["dashboard","courses","faculty","infrastructure","view"],
    faculty: ["view"],
    student: ["view"]
};
 
const WRITE_ROLES = ["admin"]; // only admin can add/delete/generate
 
function canWrite() {
    return currentUser && WRITE_ROLES.includes(currentUser.role);
}
 
// ── Apply role restrictions to UI ────────────────────────────────────────────
function applyRoleUI() {
    const role      = currentUser.role;
    const allowedTabs = ROLE_TABS[role] || ["view"];
 
    // Show/hide nav tabs
    const tabMap = {
        dashboard:      0,
        courses:        1,
        faculty:        2,
        students:       3,
        infrastructure: 4,
        generate:       5,
        view:           6,
        userMgmt:       7   // injected dynamically for admin
    };
 
    document.querySelectorAll(".nav-tab").forEach((tab, idx) => {
        const sectionIds = Object.keys(tabMap);
        const sectionId  = sectionIds[idx];
        tab.style.display = allowedTabs.includes(sectionId) ? "" : "none";
    });
 
    // Hide all write buttons for non-admin roles
    if (!canWrite()) {
        document.querySelectorAll(".btn-primary, .btn-success").forEach(btn => {
            // Keep export buttons visible for hod
            if (btn.textContent.includes("Export") || btn.textContent.includes("📄") || btn.textContent.includes("📊")) return;
            btn.style.display = "none";
        });
        // Also hide assign faculty card
        const assignCard = document.querySelector("#courses .card .card");
        if (assignCard) assignCard.style.display = "none";
    }
 
    // Update header bar with user info
    renderUserBadge();
 
    // For faculty: auto-filter timetable to their schedule
    if (role === "faculty" && currentUser.linked_id) {
        // Will be applied when timetable is displayed
    }
 
    // For student: auto-select program and semester in filter
    if (role === "student" && currentUser.linked_id) {
        const parts = currentUser.linked_id.split("|");
        if (parts.length === 2) {
            const filterProg = document.getElementById("filterProgram");
            const filterSem  = document.getElementById("filterSemester");
            if (filterProg) filterProg.value = parts[0];
            if (filterSem)  filterSem.value  = parts[1];
        }
    }
}
 
function renderUserBadge() {
    // Inject a top bar into the header if not present
    let bar = document.getElementById("userBar");
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "userBar";
        bar.style.cssText = `
            display:flex; justify-content:flex-end; align-items:center;
            gap:1rem; padding:0.75rem 2rem;
            background: rgba(255,255,255,0.06);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            font-size:0.875rem; color:rgba(255,255,255,0.85);
            position: relative; z-index: 10;
        `;
        const header = document.querySelector(".header");
        if (header) header.insertAdjacentElement("afterend", bar);
    }
 
    const roleColors = {
        admin:   "#ea5455",
        hod:     "#f7b731",
        faculty: "#26de81",
        student: "#45aaf2"
    };
    const roleEmoji = { admin:"🛡️", hod:"🎓", faculty:"👨‍🏫", student:"📚" };
    const col = roleColors[currentUser.role] || "#ccc";
 
    bar.innerHTML = `
        <span>
            ${roleEmoji[currentUser.role] || "👤"}
            <strong>${currentUser.name}</strong>
            &nbsp;
            <span style="background:${col};color:white;padding:2px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;text-transform:uppercase">
                ${currentUser.role}
            </span>
        </span>
        <button onclick="logout()" style="
            background:rgba(234,84,85,0.15); border:1px solid rgba(234,84,85,0.4);
            color:#ff9a9a; padding:0.35rem 1rem; border-radius:8px;
            cursor:pointer; font-size:0.8rem; font-weight:600;
            font-family:'DM Sans',sans-serif; transition:all 0.2s;
        " onmouseover="this.style.background='rgba(234,84,85,0.3)'"
           onmouseout="this.style.background='rgba(234,84,85,0.15)'">
            Sign Out
        </button>
    `;
}
 
// ── Inject User Management tab for admin ─────────────────────────────────────
function injectUserMgmtTab() {
    if (currentUser.role !== "admin") return;
 
    // Add nav tab
    const navTabs = document.querySelector(".nav-tabs");
    if (navTabs && !document.getElementById("tabUserMgmt")) {
        const btn = document.createElement("button");
        btn.className = "nav-tab";
        btn.id        = "tabUserMgmt";
        btn.textContent = "👥 Users";
        btn.onclick = () => showSection("userMgmt");
        navTabs.appendChild(btn);
    }
 
    // Add section
    if (!document.getElementById("userMgmt")) {
        const section = document.createElement("div");
        section.id        = "userMgmt";
        section.className = "content-section";
        section.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">User Management</h2>
                    <button class="btn btn-primary" onclick="openAddUserModal()">+ Add User</button>
                </div>
                <div id="usersList"></div>
            </div>
        `;
        document.querySelector(".container").appendChild(section);
    }
 
    // Add modal
    if (!document.getElementById("userModal")) {
        const modal = document.createElement("div");
        modal.id        = "userModal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Add New User</h3>
                    <button class="close-modal" onclick="closeModal('userModal')">&times;</button>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" class="form-input" id="newUsername" placeholder="e.g. faculty2">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-input" id="newPassword" placeholder="min 6 characters">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Full Name</label>
                        <input type="text" class="form-input" id="newName" placeholder="Dr. Jane Doe">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <select class="form-select" id="newRole" onchange="updateLinkedIdHint()">
                            <option value="admin">Admin</option>
                            <option value="hod">HOD / Principal</option>
                            <option value="faculty">Faculty</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                    <div class="form-group" id="linkedIdGroup">
                        <label class="form-label" id="linkedIdLabel">Linked ID</label>
                        <input type="text" class="form-input" id="newLinkedId" placeholder="Faculty ID or Program|Semester">
                        <small id="linkedIdHint" style="color:var(--text-secondary);font-size:0.8rem;margin-top:4px;display:block"></small>
                    </div>
                </div>
                <div class="btn-group" style="margin-top:1.5rem">
                    <button class="btn btn-primary" onclick="saveUser()">Create User</button>
                    <button class="btn btn-secondary" onclick="closeModal('userModal')">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}
 
function updateLinkedIdHint() {
    const role  = document.getElementById("newRole").value;
    const hint  = document.getElementById("linkedIdHint");
    const label = document.getElementById("linkedIdLabel");
    if (role === "faculty") {
        label.textContent = "Faculty ID (must match faculty list)";
        hint.textContent  = "e.g. FAC001 — links to their teaching schedule";
    } else if (role === "student") {
        label.textContent = "Program | Semester";
        hint.textContent  = "e.g. B.Ed.|1 — filters timetable automatically";
    } else {
        label.textContent = "Linked ID (optional)";
        hint.textContent  = "";
    }
}
 
async function saveUser() {
    const username  = document.getElementById("newUsername").value.trim();
    const password  = document.getElementById("newPassword").value;
    const name      = document.getElementById("newName").value.trim();
    const role      = document.getElementById("newRole").value;
    const linked_id = document.getElementById("newLinkedId").value.trim() || null;
 
    if (!username || !password || !name) {
        alert("Please fill in username, password, and name.");
        return;
    }
    if (password.length < 4) {
        alert("Password must be at least 4 characters.");
        return;
    }
 
    try {
        const res = await fetch(`${API}/add-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, role, name, linked_id })
        });
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Error creating user.");
            return;
        }
        closeModal("userModal");
 
        // Show credentials clearly so admin can share them
        alert(`✅ User created successfully!\n\nShare these credentials:\n👤 Username: ${username}\n🔑 Password: ${password}\n🎭 Role: ${role}`);
 
        ["newUsername","newPassword","newName","newLinkedId"].forEach(id => {
            document.getElementById(id).value = "";
        });
        await loadUsers();
    } catch (e) {
        alert("Error: " + e.message);
    }
}
 
async function loadUsers() {
    if (currentUser.role !== "admin") return;
    try {
        const res = await fetch(`${API}/users`);
        users = await res.json();
        renderUsers();
    } catch (e) {
        console.error("Could not load users:", e);
    }
}
 
function renderUsers() {
    const list = document.getElementById("usersList");
    if (!list) return;
 
    const roleColors = { admin:"#ea5455", hod:"#f7b731", faculty:"#26de81", student:"#45aaf2" };
    const roleEmoji  = { admin:"🛡️", hod:"🎓", faculty:"👨‍🏫", student:"📚" };
 
    // Instruction banner
    let html = `
        <div style="background:#f0f9ff;border:1px solid #bee3f8;border-radius:10px;padding:1rem;margin-bottom:1rem;font-size:0.85rem;color:#2c5282;">
            <strong>📌 How to create accounts:</strong><br>
            • <strong>Faculty</strong>: Set Linked ID = the Faculty ID from the Faculty tab (e.g. <code>FAC001</code>)<br>
            • <strong>Student</strong>: Set Linked ID = Program|Semester (e.g. <code>B.Ed.|1</code>)<br>
            • <strong>HOD / Admin</strong>: Linked ID can be left blank<br>
            • After creating a user, share their username &amp; password with them directly.
        </div>`;
 
    if (users.length === 0) {
        list.innerHTML = html + `<div class="alert alert-info">No users found.</div>`;
        return;
    }
 
    html += users.map(u => `
        <div class="list-item">
            <div>
                <strong>${u.username}</strong>
                &nbsp;
                <span class="badge" style="background:${roleColors[u.role]}22;color:${roleColors[u.role]};border:1px solid ${roleColors[u.role]}44">
                    ${roleEmoji[u.role] || "👤"} ${u.role}
                </span>
                <br>
                <small style="color:var(--text-secondary)">
                    ${u.name}
                    ${u.linked_id ? `&nbsp;·&nbsp; <strong>Linked ID:</strong> <code>${u.linked_id}</code>` : ""}
                </small>
            </div>
            <div class="list-item-actions">
                ${u.username !== "admin"
                    ? `<button class="btn-icon" title="Delete" onclick="deleteUser(${u.id})">❌</button>`
                    : `<span style="font-size:0.75rem;color:var(--muted)">protected</span>`
                }
            </div>
        </div>
    `).join("");
 
    list.innerHTML = html;
}
 
async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;
    try {
        await fetch(`${API}/delete-user/${id}`, { method: "DELETE" });
        await loadUsers();
    } catch (e) {
        alert("Error: " + e.message);
    }
}
 
function openAddUserModal() {
    updateLinkedIdHint();
    document.getElementById("userModal").classList.add("active");
}
 
// ================= DASHBOARD =================
 
function updateDashboard() {
    document.getElementById("totalCourses").innerText  = courses.length;
    document.getElementById("totalFaculty").innerText  = faculty.length;
    document.getElementById("totalStudents").innerText = students.length;
    document.getElementById("totalRooms").innerText    = rooms.length;
}
 
// ================= NAVIGATION =================
 
function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach(sec =>
        sec.classList.remove("active")
    );
    document.querySelectorAll(".nav-tab").forEach(tab =>
        tab.classList.remove("active")
    );
    const sec = document.getElementById(sectionId);
    if (sec) sec.classList.add("active");
 
    // Highlight matching tab
    document.querySelectorAll(".nav-tab").forEach(tab => {
        if (tab.getAttribute("onclick") && tab.getAttribute("onclick").includes(sectionId)) {
            tab.classList.add("active");
        }
    });
}
 
// ================= MODALS =================
 
function openAddCourseModal()  { if (!canWrite()) return; document.getElementById("courseModal").classList.add("active"); }
function openAddFacultyModal() { if (!canWrite()) return; document.getElementById("facultyModal").classList.add("active"); }
function openAddRoomModal()    { if (!canWrite()) return; document.getElementById("roomModal").classList.add("active"); }
function openAddStudentModal() { if (!canWrite()) return; document.getElementById("studentModal").classList.add("active"); }
 
function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}
 
// ================= RENDER FUNCTIONS =================
 
function renderCourses() {
    const list = document.getElementById("coursesList");
    if (!list) return;
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
                    ${canWrite() ? `<button class="btn-icon" title="Delete" onclick="deleteCourse('${c.code}')">❌</button>` : ""}
                </div>
            </div>
        `;
    });
}
 
function renderFaculty() {
    const list = document.getElementById("facultyList");
    if (!list) return;
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
                    ${canWrite() ? `<button class="btn-icon" title="Delete" onclick="deleteFaculty('${f.id}')">❌</button>` : ""}
                </div>
            </div>
        `;
    });
}
 
function renderRooms() {
    const list = document.getElementById("roomsList");
    if (!list) return;
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
                    ${canWrite() ? `<button class="btn-icon" title="Delete" onclick="deleteRoom('${r.number}')">❌</button>` : ""}
                </div>
            </div>
        `;
    });
}
 
function renderStudents() {
    const list = document.getElementById("studentsList");
    if (!list) return;
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
 
// ================= SAVE FUNCTIONS =================
 
async function saveCourse() {
    if (!canWrite()) return;
    const code          = document.getElementById("courseCode").value.trim();
    const name          = document.getElementById("courseName").value.trim();
    const program       = document.getElementById("courseProgram").value;
    const semester      = document.getElementById("courseSemester").value;
    const theoryHours   = parseInt(document.getElementById("theoryHours").value) || 0;
    const practicalHours= parseInt(document.getElementById("practicalHours").value) || 0;
 
    if (!code || !name) { alert("Please fill in Course Code and Course Name."); return; }
 
    try {
        const res = await fetch(`${API}/add-course`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name, program, semester, theoryHours, practicalHours })
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal("courseModal");
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
    } catch (e) { console.error("Could not load courses:", e); }
}
 
async function saveFaculty() {
    if (!canWrite()) return;
    const id       = document.getElementById("facultyId").value.trim();
    const name     = document.getElementById("facultyName").value.trim();
    const maxHours = parseInt(document.getElementById("facultyMaxHours").value) || 10;
 
    if (!id || !name) { alert("Please fill in Faculty ID and Name."); return; }
 
    const dayCheckboxes = document.querySelectorAll('#facultyModal input[type="checkbox"]');
    const availableDays = Array.from(dayCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (availableDays.length === 0) { alert("Please select at least one available day."); return; }
 
    try {
        const res = await fetch(`${API}/add-faculty`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, name, maxHours, availableDays })
        });
        if (!res.ok) throw new Error(await res.text());
        closeModal("facultyModal");
        ["facultyId","facultyName","facultyEmail","facultyDept","facultyMaxHours","facultySpec"].forEach(fid => {
            const el = document.getElementById(fid);
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
    } catch (e) { console.error("Could not load faculty:", e); }
}
 
async function saveRoom() {
    if (!canWrite()) return;
    const number = document.getElementById("roomNumber").value.trim();
    const type   = document.getElementById("roomType").value;
 
    if (!number) { alert("Please enter a room number."); return; }
 
    try {
        const res = await fetch(`${API}/add-room`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ number, type })
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
    } catch (e) { console.error("Could not load rooms:", e); }
}
 
function saveStudent() {
    if (!canWrite()) return;
    const id       = document.getElementById("studentId").value.trim();
    const name     = document.getElementById("studentName").value.trim();
    const program  = document.getElementById("studentProgram").value;
    const semester = document.getElementById("studentSemester").value;
 
    if (!id || !name) { alert("Please fill in Student ID and Name."); return; }
 
    students.push({ id, name, program, semester });
    renderStudents();
    updateDashboard();
    closeModal("studentModal");
}
 
// ================= ASSIGN FACULTY =================
 
function loadAssignDropdowns() {
    const courseSelect  = document.getElementById("assignCourse");
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
    if (!canWrite()) return;
    const courseCode = document.getElementById("assignCourse").value;
    const facultyId  = document.getElementById("assignFaculty").value;
    if (!courseCode || !facultyId) { alert("Please select both a course and a faculty member."); return; }
 
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
 
// ================= GENERATE TIMETABLE =================
 
async function generateTimetable() {
    if (!canWrite()) {
        alert("Only Admin can generate timetables.");
        return;
    }
    const selectedProgram  = document.getElementById("program").value;
    const semesterRaw      = document.getElementById("semester").value;
    const selectedSemester = semesterRaw.replace("Semester ", "");
    const resultDiv        = document.getElementById("generationResult");
    resultDiv.innerHTML    = "";
 
    if (faculty.length === 0) {
        resultDiv.innerHTML = `<div class="alert alert-error">⚠️ Please add faculty before generating.</div>`;
        return;
    }
    if (rooms.length === 0) {
        resultDiv.innerHTML = `<div class="alert alert-error">⚠️ Please add rooms before generating.</div>`;
        return;
    }
 
    const relevantCourses = courses.filter(c =>
        (selectedProgram === "All Programs" || c.program === selectedProgram) &&
        String(c.semester) === String(selectedSemester)
    );
    if (relevantCourses.length === 0) {
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                ⚠️ No courses for <strong>${selectedProgram}</strong>, Semester <strong>${selectedSemester}</strong>.
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
                courses, faculty, rooms,
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
                if (result.timetable[day][slot] !== null) { hasData = true; break; }
            }
            if (hasData) break;
        }
 
        if (result.warnings && result.warnings.length > 0) {
            resultDiv.innerHTML = result.warnings.map(w =>
                `<div class="alert alert-warning">⚠️ ${w}</div>`
            ).join("");
        }
 
        if (!hasData) {
            resultDiv.innerHTML += `<div class="alert alert-error">❌ Could not generate timetable. Check faculty assignments and room availability.</div>`;
            return;
        }
 
        resultDiv.innerHTML += `<div class="alert alert-success">✅ Timetable generated successfully!</div>`;
        generatedTimetable = result.timetable;
 
        // ── Save timetable to DB so faculty/student/hod can load it ──
        try {
            await fetch(`${API}/save-timetable`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timetable: result.timetable })
            });
        } catch (e) {
            console.warn("Could not save timetable to DB:", e);
        }
 
        displayTimetable();
        setTimeout(() => showSection("view"), 800);
 
    } catch (error) {
        document.getElementById("generationProgress").style.display = "none";
        resultDiv.innerHTML = `<div class="alert alert-error">❌ Backend not reachable. Run: <code>uvicorn main:app --reload</code></div>`;
        console.error(error);
    }
}
 
function simulateProgress() {
    const fill  = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");
    const steps = [
        [15,"Loading courses & faculty..."],
        [35,"Scheduling lab sessions..."],
        [60,"Distributing theory slots..."],
        [80,"Resolving conflicts..."],
        [95,"Finalizing timetable..."]
    ];
    let i = 0;
    const interval = setInterval(() => {
        if (i >= steps.length) { clearInterval(interval); return; }
        fill.style.width  = steps[i][0] + "%";
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
 
// ================= DISPLAY TIMETABLE =================
 
// Program badge colours
const PROG_COLORS = { "B.Ed.":"#1565c0","M.Ed.":"#6a1b9a","FYUP":"#2e7d32","ITEP":"#e65100" };
 
function buildEntryHtml(c) {
    const typeColor = c.type.startsWith("Lab") ? "#e3f2fd" : "#f0fdf4";
    const typeBadge = c.type.startsWith("Lab")
        ? `<span style="background:#1565c0;color:white;padding:2px 5px;border-radius:4px;font-size:0.68rem;font-weight:700;">LAB</span>`
        : `<span style="background:#2e7d32;color:white;padding:2px 5px;border-radius:4px;font-size:0.68rem;font-weight:700;">THEORY</span>`;
    const progColor = PROG_COLORS[c.program] || "#607d8b";
    const progBadge = c.program
        ? `<span style="background:${progColor};color:white;padding:1px 5px;border-radius:4px;font-size:0.65rem;margin-left:3px;">${c.program}</span>`
        : "";
    return `<div style="background:${typeColor};border-radius:6px;padding:5px 6px;margin-bottom:3px;border:1px solid rgba(0,0,0,0.07);">
        <div>${typeBadge}${progBadge}</div>
        <div style="font-weight:700;color:#ea5455;font-size:0.82rem;margin-top:2px;">${c.course}</div>
        <div style="font-size:0.78rem;color:#333;">${c.name}</div>
        <div style="color:#6c757d;font-size:0.74rem;">👤 ${c.faculty}</div>
        <div style="color:#6c757d;font-size:0.74rem;">🚪 ${c.room}</div>
    </div>`;
}
 
function renderTd(cellData, filterFacName, filterProgram) {
    const cells = !cellData ? [] : Array.isArray(cellData) ? cellData : [cellData];
    let visible = cells;
    if (filterFacName) visible = visible.filter(c => c.faculty === filterFacName);
    if (filterProgram && filterProgram !== "All Programs") visible = visible.filter(c => c.program === filterProgram);
    if (visible.length === 0) return `<td class="timetable-cell"></td>`;
    const inner = visible.map(c => buildEntryHtml(c)).join("");
    return `<td class="timetable-cell occupied" style="padding:5px;vertical-align:top;">${inner}</td>`;
}
 
function displayTimetable() {
    if (!generatedTimetable) return;
    const days  = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);
    const BREAK_AFTER = {
        1: "☕ Short Break (10:40 – 10:50 AM)",
        3: "🍽 Lunch Break (12:30 – 1:30 PM)",
        5: "☕ Short Break (3:10 – 3:20 PM)"
    };
 
    // ── Determine filters based on role ──────────────────────────────────────
    let filterFacName = null;
    let filterProgram = "All Programs";
 
    if (currentUser.role === "faculty" && currentUser.linked_id) {
        // Faculty sees ONLY their own classes — filter by their name
        filterFacName = getFacultyNameById(currentUser.linked_id);
    } else if (currentUser.role === "student" && currentUser.linked_id) {
        // Student sees ONLY their program — e.g. linked_id = "B.Ed.|1"
        const parts = currentUser.linked_id.split("|");
        if (parts.length >= 1) filterProgram = parts[0];
    } else {
        // Admin / HOD — use dropdown values
        const fp = document.getElementById("filterProgram");
        if (fp) filterProgram = fp.value;
    }
 
    let html = `<table class='timetable'><thead><tr><th>Time / Day</th>`;
    days.forEach(day => html += `<th>${day}</th>`);
    html += `</tr></thead><tbody>`;
    slots.forEach((slot, index) => {
        html += `<tr><td><strong>${convertTo12Hour(slot)}</strong></td>`;
        days.forEach(day => {
            html += renderTd(generatedTimetable[day][slot], filterFacName, filterProgram);
        });
        html += `</tr>`;
        if (BREAK_AFTER[index] !== undefined) {
            const bg = index === 3 ? "#fab1a0" : "#ffeaa7";
            html += `<tr style="background:${bg};font-weight:bold;text-align:center;">
                        <td colspan="${days.length + 1}">${BREAK_AFTER[index]}</td>
                     </tr>`;
        }
    });
    html += `</tbody></table>`;
    document.getElementById("timetableDisplay").innerHTML = html;
    updateFilterFacultyDropdown();
}
 
 
function getFacultyNameById(facultyId) {
    if (!facultyId) return null;
    // Match by faculty ID (primary — e.g. linked_id = "FAC001")
    const byId = faculty.find(f => f.id === facultyId);
    if (byId) return byId.name;
    // Fallback: match by name directly
    const byName = faculty.find(f => f.name === facultyId);
    return byName ? byName.name : null;
}
 
function updateFilterFacultyDropdown() {
    const sel = document.getElementById("filterFaculty");
    if (!sel) return;
    // Faculty users can only see themselves
    if (currentUser.role === "faculty") {
        const facName = getFacultyNameById(currentUser.linked_id);
        sel.innerHTML = `<option value="${currentUser.linked_id}">${facName || currentUser.name}</option>`;
        sel.disabled  = true;
        return;
    }
    sel.disabled  = false;
    sel.innerHTML = `<option value="">All Faculty</option>`;
    faculty.forEach(f => {
        sel.innerHTML += `<option value="${f.id}">${f.name}</option>`;
    });
}
 
// ================= FILTER TIMETABLE =================
 
function filterTimetable() {
    if (!generatedTimetable) {
        document.getElementById("timetableDisplay").innerHTML =
            `<div class="alert alert-info">📅 Generate timetable first.</div>`;
        return;
    }
    displayTimetable(); // re-render with current filters
}
 
// ================= DELETE FUNCTIONS =================
 
async function deleteCourse(code) {
    if (!canWrite() || !confirm(`Delete course ${code}?`)) return;
    try {
        await fetch(`${API}/delete-course/${encodeURIComponent(code)}`, { method: "DELETE" });
        await loadCoursesFromDB();
    } catch (e) { alert("Error: " + e.message); }
}
 
async function deleteFaculty(id) {
    if (!canWrite() || !confirm(`Delete faculty ${id}?`)) return;
    try {
        await fetch(`${API}/delete-faculty/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadFacultyFromDB();
    } catch (e) { alert("Error: " + e.message); }
}
 
async function deleteRoom(number) {
    if (!canWrite() || !confirm(`Delete room ${number}?`)) return;
    try {
        await fetch(`${API}/delete-room/${encodeURIComponent(number)}`, { method: "DELETE" });
        await loadRoomsFromDB();
    } catch (e) { alert("Error: " + e.message); }
}
 
// ================= EXPORT =================
 
function exportToPDF() {
    if (!generatedTimetable) { alert("Generate timetable first!"); return; }
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation: "landscape" });
    const days  = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);
 
    doc.setFontSize(16);
    doc.text("NEP 2020 Weekly Timetable", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
 
    const BREAK_AFTER = {
        1:"☕ SHORT BREAK (10:40–10:50 AM)",
        3:"🍽 LUNCH BREAK (12:30–1:30 PM)",
        5:"☕ SHORT BREAK (3:10–3:20 PM)"
    };
 
    const tableRows = [];
    slots.forEach((slot, index) => {
        let row = [convertTo12Hour(slot)];
        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            row.push(cell ? `${cell.course}\n${cell.name}\n${cell.faculty}\nRoom: ${cell.room}\n[${cell.type}]` : "—");
        });
        tableRows.push(row);
        if (BREAK_AFTER[index]) {
            tableRows.push([{
                content: BREAK_AFTER[index],
                colSpan: days.length + 1,
                styles: { halign:"center", fontStyle:"bold", fillColor:[240,230,140] }
            }]);
        }
    });
 
    doc.autoTable({
        startY: 27,
        head: [["Time", ...days]],
        body: tableRows,
        styles: { fontSize:7, cellPadding:2 },
        headStyles: { fillColor:[26,35,50] },
        columnStyles: { 0:{ cellWidth:28 } }
    });
    doc.save("NEP_Timetable.pdf");
}
 
function exportToExcel() {
    if (!generatedTimetable) { alert("Generate timetable first!"); return; }
    const days  = Object.keys(generatedTimetable);
    const slots = Object.keys(generatedTimetable[days[0]]);
    let data = [["Time", ...days]];
 
    const BREAK_AFTER = {
        1:"SHORT BREAK (10:40–10:50 AM)",
        3:"LUNCH BREAK (12:30–1:30 PM)",
        5:"SHORT BREAK (3:10–3:20 PM)"
    };
 
    slots.forEach((slot, index) => {
        let row = [convertTo12Hour(slot)];
        days.forEach(day => {
            const cell = generatedTimetable[day][slot];
            row.push(cell ? `${cell.course}\n${cell.name}\n${cell.faculty}\nRoom: ${cell.room}\n[${cell.type}]` : "—");
        });
        data.push(row);
        if (BREAK_AFTER[index]) data.push([BREAK_AFTER[index], "", "", "", "", ""]);
    });
 
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch:22 }, ...days.map(() => ({ wch:36 }))];
    ws["!rows"] = data.map(() => ({ hpt:70 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, "NEP_Timetable.xlsx");
}
 
// ================= UTILITY =================
 
function convertTo12Hour(timeRange) {
    function convert(time) {
        let [hours, minutes] = time.split(":");
        hours = parseInt(hours);
        const period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return `${hours.toString().padStart(2,"0")}:${minutes} ${period}`;
    }
    const [start, end] = timeRange.split("-");
    return `${convert(start)} – ${convert(end)}`;
}
 
// ================= INIT =================
 
window.onload = async function () {
    // 1. Check login — redirect to login.html if no session
    if (!requireLogin()) return;
 
    // 2. Apply role-based UI (show/hide tabs, buttons)
    applyRoleUI();
 
    // 3. Inject user management tab for admin
    injectUserMgmtTab();
 
    // 4. Load all data from backend — AWAIT so arrays are filled before next step
    try {
        await loadFacultyFromDB();   // fills faculty[]
        await loadCoursesFromDB();   // fills courses[]
        await loadRoomsFromDB();     // fills rooms[]
        loadAssignDropdowns();
        if (currentUser.role === "admin") await loadUsers();
    } catch (e) {
        console.warn("Could not connect to backend:", e.message);
    }
 
    const role = currentUser.role;
 
    // 5. For faculty / student / hod — go to view tab and auto-load timetable
    if (role === "faculty" || role === "student" || role === "hod") {
        showSection("view");
        await autoLoadTimetableForRole();
    }
};
 
// ── Loads the saved timetable for faculty / student / hod ────────────────────
async function autoLoadTimetableForRole() {
    const display = document.getElementById("timetableDisplay");
    if (!display) return;
 
    display.innerHTML = `<div class="alert alert-info">⏳ Loading your timetable, please wait...</div>`;
 
    try {
        // Load the timetable that Admin saved — no regeneration needed
        const response = await fetch(`${API}/load-timetable`);
 
        if (response.status === 404) {
            display.innerHTML = `
                <div class="alert alert-info" style="flex-direction:column;align-items:flex-start;gap:0.5rem;">
                    <strong>📅 No timetable available yet.</strong>
                    <span>Ask Admin to generate and save the timetable first.</span>
                </div>`;
            return;
        }
 
        if (!response.ok) {
            display.innerHTML = `<div class="alert alert-error">❌ Server error. Ask Admin to check backend.</div>`;
            return;
        }
 
        const result = await response.json();
        generatedTimetable = result.timetable;
 
        // ── For faculty: verify linked_id maps to a real faculty record ──────
        if (currentUser.role === "faculty") {
            const facName = getFacultyNameById(currentUser.linked_id);
            if (!facName) {
                display.innerHTML = `
                    <div class="alert alert-error">
                        ❌ Your Faculty ID <strong>(${currentUser.linked_id})</strong> was not found
                        in the faculty list.<br>
                        Ask Admin to ensure your Linked ID in the Users tab exactly matches
                        your Faculty ID in the Faculty tab (e.g. FAC001).
                    </div>`;
                return;
            }
        }
 
        // ── For student: lock filters to their program ────────────────────────
        if (currentUser.role === "student" && currentUser.linked_id) {
            const parts = currentUser.linked_id.split("|");
            if (parts.length >= 1) {
                const filterProg = document.getElementById("filterProgram");
                if (filterProg) { filterProg.value = parts[0]; filterProg.disabled = true; }
            }
            const filterFac = document.getElementById("filterFaculty");
            if (filterFac) filterFac.disabled = true;
        }
 
        displayTimetable();
 
    } catch (e) {
        display.innerHTML = `
            <div class="alert alert-error">
                ❌ Cannot connect to server.<br>
                Make sure backend is running: <code>uvicorn main:app --reload</code>
            </div>`;
        console.error("autoLoadTimetableForRole error:", e);
    }
}
