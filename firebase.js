import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, query, limit }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

/* Kosongkan soal contoh; soal sebenarnya diambil dari database */
if (window.EXAM_DATA && Array.isArray(window.EXAM_DATA.questions)) window.EXAM_DATA.questions.length = 0;

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

const SOAL_KEY = "eujian.soalExtra";
const ATT_KEY = "eujian.attempts";
const PEND_KEY = "cloud.pending";
const STAFF = ["guru", "admin", "kepala"];
const rawSet = Storage.prototype.setItem;

/* ---------- helper ---------- */
function lsGet(key, fb) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch (e) { return fb; }
}
function lsSetRaw(key, val) {
  try { rawSet.call(localStorage, key, JSON.stringify(val)); } catch (e) { console.error(e); }
}
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
const sortById = (list) => list.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
const clean = (o) => JSON.parse(JSON.stringify(o));
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]).catch(() => null);

function toast(msg, danger) {
  const root = document.getElementById("toast-root");
  if (!root) { console.log(msg); return; }
  const el = document.createElement("div");
  el.className = "toast" + (danger ? " danger" : "");
  const s = document.createElement("span");
  s.textContent = msg;
  el.appendChild(s);
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 200); }, 3500);
}

/* ---------- login guru ---------- */
let loginPromise = null;
function isGuru() { return auth.authStateReady().then(() => !!auth.currentUser); }
function askLogin() {
  if (loginPromise) return loginPromise;
  loginPromise = new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px";
    wrap.innerHTML =
      '<div style="background:#fff;color:#111;border-radius:14px;padding:20px;width:100%;max-width:360px;font-family:inherit">' +
      '<h3 style="margin:0 0 4px;font-size:16px">Masuk Database (Guru)</h3>' +
      '<p style="margin:0 0 14px;font-size:12.5px;color:#555">Diperlukan untuk menyimpan data ke database online.</p>' +
      '<input id="cEmail" type="email" placeholder="Email guru" autocomplete="username" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border:1px solid #ccc;border-radius:8px;font-size:14px">' +
      '<input id="cPass" type="password" placeholder="Kata sandi" autocomplete="current-password" style="width:100%;box-sizing:border-box;padding:10px;margin-bottom:8px;border:1px solid #ccc;border-radius:8px;font-size:14px">' +
      '<p id="cErr" style="color:#c00;font-size:12.5px;margin:0 0 8px;display:none"></p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button id="cCancel" type="button" style="padding:9px 14px;border:1px solid #ccc;background:#fff;border-radius:8px;cursor:pointer">Batal</button>' +
      '<button id="cOk" type="button" style="padding:9px 14px;border:0;background:#0f7a63;color:#fff;border-radius:8px;cursor:pointer">Masuk</button>' +
      "</div></div>";
    document.body.appendChild(wrap);
    const done = (ok) => { wrap.remove(); loginPromise = null; resolve(ok); };
    wrap.querySelector("#cCancel").onclick = () => done(false);
    wrap.querySelector("#cOk").onclick = async () => {
      const err = wrap.querySelector("#cErr");
      try {
        await signInWithEmailAndPassword(auth, wrap.querySelector("#cEmail").value.trim(), wrap.querySelector("#cPass").value);
        toast("Berhasil masuk ke database.");
        done(true);
      } catch (e) { err.style.display = "block"; err.textContent = "Email atau kata sandi salah."; }
    };
  });
  return loginPromise;
}

/* ---------- antrean kirim ke database ---------- */
function enqueue(op) {
  const q = lsGet(PEND_KEY, []).filter((x) => !(x.col === op.col && x.id === op.id));
  q.push(op);
  lsSetRaw(PEND_KEY, q);
}
let flushing = false;
async function flush(promptLogin) {
  if (flushing) return;
  flushing = true;
  try {
    const q = lsGet(PEND_KEY, []);
    if (!q.length) return;
    let guruOk = await isGuru();
    if (!guruOk && promptLogin && q.some((x) => x.col === "soal" || x.op === "del")) guruOk = await askLogin();
    const soal = lsGet(SOAL_KEY, []);
    const att = lsGet(ATT_KEY, []);
    const left = [];
    let sentSoal = 0, sentHasil = 0, failed = 0;
    for (const x of q) {
      try {
        if (x.col === "soal") {
          if (!guruOk) { left.push(x); continue; }
          if (x.op === "del") await deleteDoc(doc(db, "soal", x.id));
          else { const item = soal.find((s) => s.id === x.id); if (item) await setDoc(doc(db, "soal", x.id), clean(item)); }
          sentSoal++;
        } else {
          if (x.op === "del") {
            if (!guruOk) { left.push(x); continue; }
            await deleteDoc(doc(db, "hasil", x.id));
          } else {
            const rec = att.find((a) => a.id === x.id);
            if (rec) await setDoc(doc(db, "hasil", x.id), clean(rec));
          }
          sentHasil++;
        }
      } catch (e) { console.error(e); left.push(x); failed++; }
    }
    lsSetRaw(PEND_KEY, left);
    if (sentSoal) toast("Soal tersimpan ke database online.");
    if (sentHasil) toast("Data hasil ujian terkirim ke database.");
    if (failed) toast("Sebagian data gagal dikirim ke database. Akan dicoba lagi.", true);
    else if (left.length) toast(left.length + " perubahan menunggu masuk database (perlu login guru).", true);
  } finally { flushing = false; }
}

/* ---------- pantau penyimpanan aplikasi ---------- */
function parse(v) { try { return JSON.parse(v); } catch (e) { return []; } }
Storage.prototype.setItem = function (key, value) {
  const watch = this === localStorage && (key === SOAL_KEY || key === ATT_KEY);
  const old = watch ? lsGet(key, []) : null;
  rawSet.call(this, key, value);
  if (!watch) return;
  try {
    const now = parse(value);
    const oldMap = new Map(old.filter((x) => x && x.id).map((x) => [x.id, x]));
    const nowIds = new Set(now.filter((x) => x && x.id).map((x) => x.id));
    const col = key === SOAL_KEY ? "soal" : "hasil";
    now.forEach((x) => {
      if (!x || !x.id) return;
      const o = oldMap.get(x.id);
      if (!o || stable(o) !== stable(x)) enqueue({ op: "set", col, id: x.id });
    });
    old.forEach((x) => { if (x && x.id && !nowIds.has(x.id)) enqueue({ op: "del", col, id: x.id }); });
    flush(true);
  } catch (e) { console.error(e); }
};

/* ---------- tarik data terbaru saat halaman dibuka ---------- */
async function pullCol(name) {
  const snap = await getDocs(query(collection(db, name), limit(500)));
  return snap.docs.map((d) => d.data());
}

async function syncDown() {
  const page = document.body && document.body.getAttribute("data-page");
  const sess = lsGet("eujian.session", null);
  const staff = !!(sess && STAFF.includes(sess.role));
  let changed = false;

  if (["bank-soal", "import", "sinkron"].includes(page)) {
    const cloud = await withTimeout(pullCol("soal"), 8000);
    if (!cloud) {
      toast("Database lambat merespons, memakai data di perangkat ini.", true);
    } else {
      const pend = lsGet(PEND_KEY, []).filter((x) => x.col === "soal");
      const skip = new Set(pend.map((x) => x.id));
      const pendSet = new Set(pend.filter((x) => x.op === "set").map((x) => x.id));
      const local = lsGet(SOAL_KEY, []);
      if (!cloud.length) {
        if (staff && local.length) { local.forEach((q) => enqueue({ op: "set", col: "soal", id: q.id })); flush(true); }
      } else {
        const merged = cloud.filter((q) => !skip.has(q.id)).concat(local.filter((q) => pendSet.has(q.id)));
        if (stable(sortById(merged)) !== stable(sortById(local))) { lsSetRaw(SOAL_KEY, merged); changed = true; }
      }
    }
  }

  if (page === "hasil" && staff) {
    let ok = await isGuru();
    if (!ok) ok = await askLogin();
    if (ok) {
      const cloud = await withTimeout(pullCol("hasil"), 8000);
      if (cloud) {
        const delIds = new Set(lsGet(PEND_KEY, []).filter((x) => x.col === "hasil" && x.op === "del").map((x) => x.id));
        const local = lsGet(ATT_KEY, []);
        const map = new Map(local.filter((a) => a.id).map((a) => [a.id, a]));
        cloud.forEach((a) => { if (!delIds.has(a.id)) map.set(a.id, a); });
        const merged = Array.from(map.values()).concat(local.filter((a) => !a.id));
        if (stable(sortById(merged)) !== stable(sortById(local))) { lsSetRaw(ATT_KEY, merged); changed = true; }
      }
    }
  }

  if (changed) {
    const last = Number(sessionStorage.getItem("cloud.lastReload") || 0);
    if (Date.now() - last > 15000) {
      sessionStorage.setItem("cloud.lastReload", String(Date.now()));
      location.reload();
    }
  }
}

const sessNow = lsGet("eujian.session", null);
syncDown().catch((e) => console.error(e)).finally(() => flush(!!(sessNow && STAFF.includes(sessNow.role))));
