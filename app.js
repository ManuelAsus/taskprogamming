import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export const usersCollectionRef = collection(db, "users");
export const projectsCollectionRef = collection(db, "projects");
export const tasksCollectionRef = collection(db, "tasks");

export async function loginUser(email, password) {
  const q = query(usersCollectionRef, where("email", "==", email), where("password", "==", password));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const userDoc = snapshot.docs[0];
  return { id: userDoc.id, ...userDoc.data() };
}

export async function createUser(profile, userRef = doc(usersCollectionRef)) {
  const q = query(usersCollectionRef, where("email", "==", profile.email));
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error("Ya existe un usuario con ese correo electrónico.");
  }

  await setDoc(userRef, {
    fullName: profile.fullName,
    email: profile.email,
    password: profile.password,
    birthDate: profile.birthDate,
    address: profile.address,
    createdAt: serverTimestamp(),
    role: "user",
    photoFileId: profile.photoFileId || null,
    photoMime: profile.photoMime || null,
    documentFileId: profile.documentFileId || null,
    documentMime: profile.documentMime || null,
    documentName: profile.documentName || null
  });
  return userRef;
}

export function saveSession(user) {
  localStorage.setItem("taskprog_user", JSON.stringify({ id: user.id, email: user.email, fullName: user.fullName }));
}

export function getSession() {
  const data = localStorage.getItem("taskprog_user");
  return data ? JSON.parse(data) : null;
}

export function clearSession() {
  localStorage.removeItem("taskprog_user");
}

export async function listUsers() {
  const snapshot = await getDocs(query(usersCollectionRef, orderBy("fullName")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveFileChunks(parentDocRef, fieldName, file) {
  if (!file) {
    return null;
  }
  const chunkSize = 450000;
  const fileId = `${fieldName}-${Date.now()}`;
  const chunks = [];
  for (let start = 0, index = 0; start < file.size; start += chunkSize, index++) {
    const slice = file.slice(start, start + chunkSize);
    const dataUrl = await blobToBase64(slice);
    const base64Data = dataUrl.split(",")[1];
    chunks.push({ index, data: base64Data });
  }

  const fileCollection = collection(parentDocRef, "fileChunks");
  for (const chunk of chunks) {
    const chunkRef = doc(fileCollection, `${fileId}-${chunk.index}`);
    await setDoc(chunkRef, {
      fileId,
      fieldName,
      index: chunk.index,
      data: chunk.data,
      mimeType: file.type,
      fileName: file.name
    });
  }

  return {
    fileId,
    mimeType: file.type,
    fileName: file.name,
    size: file.size,
    chunkCount: chunks.length
  };
}

export async function readFileChunks(parentDocRef, fileId) {
  const fileCollection = collection(parentDocRef, "fileChunks");
  const q = query(fileCollection, where("fileId", "==", fileId), orderBy("index"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const chunks = snapshot.docs
    .sort((a, b) => a.data().index - b.data().index)
    .map(doc => doc.data().data);

  const { mimeType, fileName } = snapshot.docs[0].data();
  const blob = base64ChunksToBlob(chunks, mimeType);
  return { blob, fileName, mimeType };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ChunksToBlob(chunks, mime) {
  const byteArrays = [];
  for (const chunk of chunks) {
    const binaryString = atob(chunk);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    byteArrays.push(bytes);
  }
  return new Blob(byteArrays, { type: mime });
}

export async function createProject(project, projectRef = doc(projectsCollectionRef)) {
  const data = {
    name: project.name,
    client: project.client,
    companyAddressText: project.companyAddressText,
    companyAddressMap: project.companyAddressMap,
    cost: project.cost,
    technologies: project.technologies,
    createdAt: serverTimestamp()
  };
  if (project.photoMeta) {
    data.photoFileId = project.photoMeta.fileId;
    data.photoMime = project.photoMeta.mimeType;
    data.photoName = project.photoMeta.fileName;
  }
  await setDoc(projectRef, data);
  return projectRef;
}

export async function createTask(task, taskRef = doc(tasksCollectionRef)) {
  await setDoc(taskRef, {
    projectId: task.projectId,
    projectName: task.projectName,
    name: task.name,
    description: task.description,
    assignedTo: task.assignedTo,
    assignedToName: task.assignedToName,
    url: task.url || "",
    status: "Vista",
    createdAt: serverTimestamp(),
    referenceFiles: task.referenceFiles || [],
    commentHistory: task.commentHistory || []
  });
  return taskRef;
}

export async function updateTaskStatus(taskId, status) {
  const taskRef = doc(tasksCollectionRef, taskId);
  return updateDoc(taskRef, { status });
}

export async function saveTaskComment(taskId, comment) {
  const taskRef = doc(tasksCollectionRef, taskId);
  const taskDoc = await getDoc(taskRef);
  if (!taskDoc.exists()) {
    throw new Error("Actividad no encontrada.");
  }
  const existing = taskDoc.data().commentHistory || [];
  await updateDoc(taskRef, { commentHistory: [...existing, comment] });
}

export async function getProjects() {
  const snapshot = await getDocs(query(projectsCollectionRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTasks() {
  const snapshot = await getDocs(query(tasksCollectionRef, orderBy("createdAt", "desc")));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getTask(taskId) {
  const taskRef = doc(tasksCollectionRef, taskId);
  const snapshot = await getDoc(taskRef);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function getFileUrl(parentDocRef, fileId) {
  const stored = await readFileChunks(parentDocRef, fileId);
  if (!stored) {
    return null;
  }
  return URL.createObjectURL(stored.blob);
}

export function normalizeText(value) {
  return value.trim();
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const user = await loginUser(email, password);
      if (!user) {
        alert("Correo o contraseña incorrectos.");
        return;
      }
      saveSession(user);
      window.location.href = "dashboard.html";
    } catch (error) {
      alert("Error al iniciar sesión: " + error.message);
    }
  });
}

const showForgot = document.getElementById("showForgot");
const forgotSection = document.getElementById("forgotSection");
if (showForgot && forgotSection) {
  showForgot.addEventListener("click", () => {
    forgotSection.classList.toggle("hidden");
  });
}

const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}
