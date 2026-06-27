import { getSession, clearSession, createProject, getProjects, listUsers, createTask, getTasks, updateTaskStatus, saveTaskComment, saveFileChunks, projectsCollectionRef, tasksCollectionRef } from "./app.js";
import { doc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const session = getSession();
if (!session) {
  window.location.href = "index.html";
}

const showProjectsButton = document.getElementById("showProjects");
const showActivitiesButton = document.getElementById("showActivities");
const projectsSection = document.getElementById("projectsSection");
const activitiesSection = document.getElementById("activitiesSection");
const projectForm = document.getElementById("projectForm");
const projectList = document.getElementById("projectList");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const projectAddressMap = document.getElementById("projectAddressMap");
const projectMap = document.getElementById("projectMap");
const taskProjectSelect = document.getElementById("taskProjectSelect");
const taskUserSelect = document.getElementById("taskUserSelect");
const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

function setActiveSection(active) {
  showProjectsButton.classList.toggle("active", active === "projects");
  showActivitiesButton.classList.toggle("active", active === "tasks");
  projectsSection.classList.toggle("hidden", active !== "projects");
  activitiesSection.classList.toggle("hidden", active !== "tasks");
}

showProjectsButton.addEventListener("click", () => setActiveSection("projects"));
showActivitiesButton.addEventListener("click", () => setActiveSection("tasks"));

const map = L.map(projectMap || "projectMap").setView([19.432608, -99.133209], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let selectedCoords = null;
map.on("click", (event) => {
  selectedCoords = event.latlng;
  projectAddressMap.value = `${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`;
});

async function loadSelectOptions() {
  const [projects, users] = await Promise.all([getProjects(), listUsers()]);
  taskProjectSelect.innerHTML = `<option value="" disabled selected>Selecciona un proyecto</option>`;
  projects.forEach(project => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    taskProjectSelect.appendChild(option);
  });

  taskUserSelect.innerHTML = `<option value="" disabled selected>Selecciona un usuario</option>`;
  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.fullName;
    taskUserSelect.appendChild(option);
  });
}

async function refreshProjects() {
  projectList.innerHTML = "";
  const projects = await getProjects();
  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <h3>${project.name}</h3>
      <p><strong>Cliente:</strong> ${project.client}</p>
      <p><strong>Dirección:</strong> ${project.companyAddressText}</p>
      <p><strong>Mapa:</strong> ${project.companyAddressMap}</p>
      <p><strong>Costo:</strong> $${project.cost}</p>
      <p><strong>Tecnologías:</strong> ${project.technologies}</p>
    `;
    projectList.appendChild(card);
  });
  await loadSelectOptions();
}

async function refreshTasks() {
  taskList.innerHTML = "";
  const tasks = await getTasks();
  tasks.forEach((task) => {
    const commentHistory = task.commentHistory || [];
    const commentRows = commentHistory
      .map(comment => `
        <div class="comment-entry">
          <div class="comment-meta"><strong>${comment.author}</strong> · ${new Date(comment.createdAt).toLocaleString()}</div>
          <p>${comment.text}</p>
          ${comment.attachments && comment.attachments.length ? `<div class="attachment-list">${comment.attachments.map(file => `<div>${file.fileName}</div>`).join("")}</div>` : ""}
        </div>
      `)
      .join("");

    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <h3>${task.name}</h3>
      <p><strong>Proyecto:</strong> ${task.projectName}</p>
      <p><strong>Asignado a:</strong> ${task.assignedToName}</p>
      <p><strong>Estatus:</strong> ${task.status}</p>
      <p>${task.description}</p>
      <p><strong>URL:</strong> ${task.url || "No aplica"}</p>
      <div class="task-actions">
        <button class="secondary" data-taskid="${task.id}" data-status="Vista">Vista</button>
        <button class="secondary" data-taskid="${task.id}" data-status="En desarrollo">En desarrollo</button>
        <button class="secondary" data-taskid="${task.id}" data-status="Terminando">Terminando</button>
        <button class="secondary" data-taskid="${task.id}" data-status="Finalizada">Finalizada</button>
      </div>
      <div class="comment-box">
        <textarea placeholder="Agregar comentario..." data-taskid="${task.id}"></textarea>
        <label class="comment-file-label">
          Adjuntar archivos
          <input type="file" data-fileinput="${task.id}" accept="image/*,.html,.css,.js,.php,.txt" multiple>
        </label>
        <button class="primary" data-comment="${task.id}">Guardar comentario</button>
      </div>
      <div class="file-list">
        <strong>Referencias:</strong>
        ${task.referenceFiles && task.referenceFiles.length > 0 ? task.referenceFiles.map(file => `<div>${file.fileName}</div>`).join("") : "<div>No hay archivos.</div>"}
      </div>
      ${commentRows ? `<div class="comment-history"><h4>Historial de comentarios</h4>${commentRows}</div>` : ""}
    `;

    card.querySelectorAll("button[data-status]").forEach(button => {
      button.addEventListener("click", async () => {
        await updateTaskStatus(button.dataset.taskid, button.dataset.status);
        refreshTasks();
      });
    });

    const commentButton = card.querySelector(`button[data-comment="${task.id}"]`);
    const commentTextarea = card.querySelector(`textarea[data-taskid="${task.id}"]`);
    const fileInput = card.querySelector(`input[data-fileinput="${task.id}"]`);
    if (commentButton && commentTextarea) {
      commentButton.addEventListener("click", async () => {
        if (!commentTextarea.value.trim() && (!fileInput || fileInput.files.length === 0)) {
          return;
        }
        const attachments = fileInput && fileInput.files.length > 0
          ? await uploadCommentFiles(doc(tasksCollectionRef, task.id), Array.from(fileInput.files))
          : [];
        await saveTaskComment(task.id, {
          author: session.fullName,
          text: commentTextarea.value.trim(),
          createdAt: new Date().toISOString(),
          attachments
        });
        commentTextarea.value = "";
        if (fileInput) fileInput.value = "";
        refreshTasks();
      });
    }

    taskList.appendChild(card);
  });
}

async function uploadReferenceFiles(taskRef, files) {
  const uploaded = [];
  for (const file of files) {
    const meta = await saveFileChunks(taskRef, `reference-${file.name}-${Date.now()}`, file);
    uploaded.push({ fileName: file.name, fileId: meta.fileId, mimeType: meta.mimeType });
  }
  return uploaded;
}

async function uploadCommentFiles(taskRef, files) {
  const uploaded = [];
  for (const file of files) {
    const meta = await saveFileChunks(taskRef, `comment-${file.name}-${Date.now()}`, file);
    uploaded.push({ fileName: file.name, fileId: meta.fileId, mimeType: meta.mimeType });
  }
  return uploaded;
}

if (projectForm) {
  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const projectPhoto = document.getElementById("projectPhoto").files[0];
    const name = document.getElementById("projectName").value.trim();
    const client = document.getElementById("projectClient").value.trim();
    const companyAddressText = document.getElementById("projectAddressText").value.trim();
    const companyAddressMap = projectAddressMap.value.trim();
    const cost = document.getElementById("projectCost").value.trim();
    const technologies = document.getElementById("projectTech").value.trim();

    if (!companyAddressMap) {
      alert("Selecciona una dirección en el mapa.");
      return;
    }

    let photoMeta = null;
    if (projectPhoto) {
      const projectRef = doc(projectsCollectionRef);
      photoMeta = await saveFileChunks(projectRef, "projectPhoto", projectPhoto);
      await createProject({
        name,
        client,
        companyAddressText,
        companyAddressMap,
        cost,
        technologies,
        photoMeta
      }, projectRef);
    } else {
      await createProject({
        name,
        client,
        companyAddressText,
        companyAddressMap,
        cost,
        technologies
      });
    }

    projectForm.reset();
    projectAddressMap.value = "";
    selectedCoords = null;
    await refreshProjects();
  });
}

if (taskForm) {
  taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const projectId = taskProjectSelect.value;
    const assignedTo = taskUserSelect.value;
    const assignedToName = taskUserSelect.options[taskUserSelect.selectedIndex].textContent;
    const name = document.getElementById("taskName").value.trim();
    const description = document.getElementById("taskDescription").value.trim();
    const url = document.getElementById("taskUrl").value.trim();
    const files = Array.from(document.getElementById("taskReferenceFiles").files || []);

    if (!projectId || !assignedTo) {
      alert("Selecciona un proyecto y un usuario para la actividad.");
      return;
    }

    const taskRef = doc(tasksCollectionRef);
    const referenceFiles = files.length > 0 ? await uploadReferenceFiles(taskRef, files) : [];
    const project = (await getProjects()).find(item => item.id === projectId) || {};

    await createTask({
      projectId,
      projectName: project.name || "",
      name,
      description,
      assignedTo,
      assignedToName,
      url,
      referenceFiles
    }, taskRef);

    taskForm.reset();
    await refreshTasks();
  });
}

setActiveSection("projects");
refreshProjects();
refreshTasks();
