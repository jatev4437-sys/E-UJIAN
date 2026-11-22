import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzG9hiu4rSeJ9ogGdKwNVXL5BpMbH2ceM",
  authDomain: "ujian-48513.firebaseapp.com",
  projectId: "ujian-48513",
  storageBucket: "ujian-48513.firebasestorage.app",
  messagingSenderId: "650553260815",
  appId: "1:650553260815:web:c2ccd0f5e292a823329c7a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
