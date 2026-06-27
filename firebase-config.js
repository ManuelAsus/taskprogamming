import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBATlbSMpYXRkiyoFVi8090R9N3og99FNk",
  authDomain: "taskprogamming.firebaseapp.com",
  projectId: "taskprogamming",
  storageBucket: "taskprogamming.firebasestorage.app",
  messagingSenderId: "832363284013",
  appId: "1:832363284013:web:bd58d36411a4250ff89aa4",
  measurementId: "G-LJ93GZHHW9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
