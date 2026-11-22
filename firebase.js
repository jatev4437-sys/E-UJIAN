import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit, writeBatch }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyAzG9hiu4rSeJ9ogGdKwNVXL5BpMbH2ceM",
  authDomain: "ujian-48513.firebaseapp.com",
  projectId: "ujian-48513",
  storageBucket: "ujian-48513.firebasestorage.app",
  messagingSenderId: "650553260815",
  appId: "1:650553260815:web:c2ccd0f5e292a823329c7a"
});
const db = getFirestore(app);
const auth = getAuth(app);
const clean = (o) => JSON.parse(JSON.stringify(o));

window.fb = {
  async loginGuru(email, password) { await signInWithEmailAndPassword(auth, email, password); },
  async isGuru() { await auth.authStateReady(); return !!auth.currentUser; },
  async pullSoal() {
    const snap = await getDocs(collection(db, "soal"));
    return snap.docs.map((d) => d.data());
  },
  async saveSoal(q) { await setDoc(doc(db, "soal", q.id), clean(q)); },
  async saveSoalMany(list) {
    for (let i = 0; i < list.length; i += 400) {
      const batch = writeBatch(db);
      list.slice(i, i + 400).forEach((q) => batch.set(doc(db, "soal", q.id), clean(q)));
      await batch.commit();
    }
  },
  async deleteSoal(id) { await deleteDoc(doc(db, "soal", id)); },
  async saveHasil(rec) { await setDoc(doc(db, "hasil", rec.id), clean(rec)); },
  async pullHasil() {
    const snap = await getDocs(query(collection(db, "hasil"), orderBy("at", "desc"), limit(500)));
    return snap.docs.map((d) => d.data());
  }
};
