import { createUser, saveFileChunks, usersCollectionRef } from "./app.js";
import { doc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const form = document.getElementById("adminCreateUserForm");
const message = document.getElementById("adminMessage");

function showMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.className = `message ${type}`;
}

async function fileToBase64Chunks(file, parentDocRef, fieldName) {
  return await saveFileChunks(parentDocRef, fieldName, file);
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("Creando usuario…", "info");

    const photoFile = document.getElementById("photoFile").files[0];
    const documentFile = document.getElementById("documentFile").files[0];
    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const birthDate = document.getElementById("birthDate").value;
    const address = document.getElementById("address").value.trim();

    if (!photoFile || !documentFile) {
      showMessage("La foto de perfil y el documento PDF son obligatorios.", "error");
      return;
    }

    try {
      const userRef = doc(usersCollectionRef);
      const photoMeta = await fileToBase64Chunks(photoFile, userRef, "photo");
      const documentMeta = await fileToBase64Chunks(documentFile, userRef, "document");

      await createUser({
        fullName,
        email,
        password,
        birthDate,
        address,
        photoFileId: photoMeta.fileId,
        photoMime: photoMeta.mimeType,
        documentFileId: documentMeta.fileId,
        documentMime: documentMeta.mimeType,
        documentName: documentMeta.fileName
      }, userRef);

      form.reset();
      showMessage("Usuario creado correctamente.", "success");
    } catch (error) {
      showMessage("Error al crear el usuario: " + error.message, "error");
    }
  });
}
