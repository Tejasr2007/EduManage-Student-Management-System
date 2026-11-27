
const API_URL = "http://localhost:8081/students";

let students = [];

// Safely display text
function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Load students from MySQL through Java
async function loadStudents() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not load students");
        }

        students = await response.json();
        renderAll();

    } catch (error) {
        console.error(error);
        showToast("Cannot connect to Java server!");
    }
}

// Set today's date
document.getElementById("today").textContent =
    new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

// Change pages
function showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.add("hidden");
    });

    document.getElementById(page + "-page").classList.remove("hidden");

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
    });

    const activeLink = document.querySelector(
        `.nav-link[data-page="${page}"]`
    );

    if (activeLink) activeLink.classList.add("active");

    const titles = {
        dashboard: "Dashboard Overview",
        students: "Student Directory",
        add: "Add New Student"
    };

    document.getElementById("page-title").textContent = titles[page];
    document.getElementById("breadcrumb").textContent = titles[page];

    renderAll();
}

// Sidebar navigation
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", function(event) {
        event.preventDefault();
        showPage(this.dataset.page);
    });
});

// Department display
function renderDepartments() {
    const departments = {};

    students.forEach(student => {
        departments[student.department] =
            (departments[student.department] || 0) + 1;
    });

    const colors = ["#8068e9", "#45a0dd", "#e8a34c", "#42b58a", "#df7e9c"];

    document.getElementById("department-list").innerHTML =
        Object.entries(departments).map(([name, count], index) => {
            const percentage = students.length
                ? (count / students.length) * 100
                : 0;

            return `
                <div class="department-item">
                    <div class="department-label">
                        <span>${safeText(name)}</span>
                        <span>${count} Students</span>
                    </div>
                    <div class="progress">
                        <span style="width:${percentage}%; background:${colors[index % colors.length]}"></span>
                    </div>
                </div>
            `;
        }).join("") || "<p>No department records yet.</p>";
}

// Dashboard statistics
function renderDashboard() {
    const departments = new Set(students.map(s => s.department));

    document.getElementById("total-count").textContent = students.length;
    document.getElementById("department-count").textContent = departments.size;

    document.getElementById("first-year-count").textContent =
        students.filter(s => Number(s.year) === 1).length;

    document.getElementById("other-year-count").textContent =
        students.filter(s => Number(s.year) !== 1).length;

    renderDepartments();

    const recent = [...students].slice(-4).reverse();

    document.getElementById("recent-table").innerHTML =
        recent.map(student => `
            <tr>
                <td>
                    <div class="student-name">
                        <div class="student-avatar">
                            ${safeText(student.name.charAt(0).toUpperCase())}
                        </div>
                        ${safeText(student.name)}
                    </div>
                </td>
                <td>${safeText(student.email)}</td>
                <td>${safeText(student.department)}</td>
                <td>${safeText(student.year)} Year</td>
            </tr>
        `).join("") || `
            <tr><td colspan="4">No students registered yet.</td></tr>
        `;
}

// Student directory
function renderStudents(searchValue = "") {
    const filtered = students.filter(student => {
        const searchText = searchValue.toLowerCase();

        return (
            student.name.toLowerCase().includes(searchText) ||
            student.email.toLowerCase().includes(searchText) ||
            student.department.toLowerCase().includes(searchText)
        );
    });

    document.getElementById("students-table").innerHTML =
        filtered.map(student => `
            <tr>
                <td>${student.id}</td>
                <td>
                    <div class="student-name">
                        <div class="student-avatar">
                            ${safeText(student.name.charAt(0).toUpperCase())}
                        </div>
                        ${safeText(student.name)}
                    </div>
                </td>
                <td>${safeText(student.email)}</td>
                <td>${safeText(student.phone || "-")}</td>
                <td>${safeText(student.department)}</td>
                <td>${safeText(student.year)} Year</td>
                <td>
                    <button class="action-btn"
                        onclick="editStudent(${student.id})">Edit</button>
                    <button class="action-btn delete-btn"
                        onclick="deleteStudent(${student.id})">Delete</button>
                </td>
            </tr>
        `).join("");

    document.getElementById("empty-message").classList.toggle(
        "hidden", filtered.length !== 0
    );
}

// Add student to MySQL
document.getElementById("student-form").addEventListener(
    "submit", async function(event) {

        event.preventDefault();

        const student = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            department: document.getElementById("department").value,
            year: document.getElementById("year").value
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams(student)
            });

            const result = await response.json();

            if (!response.ok) {
                showToast(result.message || "Could not save student!");
                return;
            }

            this.reset();

            await loadStudents();

            showToast("Student saved successfully!");
            showPage("students");

        } catch (error) {
            console.error(error);
            showToast("Cannot connect to Java server!");
        }
    }
);

// Edit student in MySQL
async function editStudent(id) {
    const student = students.find(s => s.id === id);

    if (!student) return;

    const newName = prompt("Enter student name:", student.name);

    if (newName === null) return;

    if (!newName.trim()) {
        showToast("Name cannot be empty!");
        return;
    }

    const newPhone = prompt("Enter phone number:", student.phone || "");

    if (newPhone === null) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                name: newName.trim(),
                phone: newPhone.trim()
            })
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Update failed!");
            return;
        }

        await loadStudents();
        showToast("Student updated successfully!");

    } catch (error) {
        console.error(error);
        showToast("Cannot connect to Java server!");
    }
}

// Delete student from MySQL
async function deleteStudent(id) {
    if (!confirm("Are you sure you want to delete this student?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            showToast(result.message || "Delete failed!");
            return;
        }

        await loadStudents();
        showToast("Student deleted successfully!");

    } catch (error) {
        console.error(error);
        showToast("Cannot connect to Java server!");
    }
}

// Search students
document.getElementById("search").addEventListener("input", function() {
    renderStudents(this.value);
});

// Toast message
function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// Refresh dashboard and directory
function renderAll() {
    renderDashboard();

    const search = document.getElementById("search");
    renderStudents(search ? search.value : "");
}

// Load real database records when website opens
loadStudents();
