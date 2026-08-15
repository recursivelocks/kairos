// Kairos GPS - Cloud Firebase Authentication & Firestore Sync Module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { state, mergeState } from './state.js';

// Observers import to trigger UI redraws on cloud sync downloads
import {
  renderBacklog,
  renderHistory,
  renderCompass,
  renderTimeline,
  setupActiveFocusBlock,
  updateViewVisibility
} from './ui-render.js';

const firebaseConfig = {
  projectId: "kairos-e3e51",
  appId: "1:722719666842:web:2f06c0fcdbc5f2125d6523",
  storageBucket: "kairos-e3e51.firebasestorage.app",
  apiKey: "AIzaSyCgiC-A56GB7V26YUFqQcQXKn31Z9eOV5Y",
  authDomain: "kairos-e3e51.firebaseapp.com",
  messagingSenderId: "722719666842",
  measurementId: "G-S24TZZKT2W"
};

let firebaseApp = null;
let auth = null;
let db = null;

export let isFirebaseActive = false;
export let currentUser = null;

/**
 * Initialize Firebase SDK modules
 */
export function initializeFirebase() {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    setupFirebaseObservers();
    isFirebaseActive = true;
  } catch (err) {
    console.error("Firebase init error:", err);
    isFirebaseActive = false;
  }
}

/**
 * Trigger Google Sign In Flow
 */
export async function signInWithGoogle() {
  if (!isFirebaseActive || !auth) {
    throw new Error("Cloud synchronization is currently offline.");
  }
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

/**
 * Trigger Sign Out Flow
 */
export async function signOutFirebase() {
  if (!auth) return;
  return signOut(auth);
}

/**
 * Sync active state changes to Cloud Firestore
 */
export async function syncStateToCloud() {
  if (!isFirebaseActive || !currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    // Exclude runtime interval identifiers to avoid pollution
    const cleanTimer = { ...state.timer, intervalId: null };
    const cleanState = { ...state, timer: cleanTimer };
    
    await setDoc(docRef, { state: cleanState }, { merge: true });
    console.log("Cloud sync complete.");
  } catch (err) {
    console.error("Cloud sync failed:", err);
  }
}

/**
 * Retrieve state parameters from Cloud Firestore
 */
export async function loadStateFromCloud() {
  if (!isFirebaseActive || !currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const cloudState = docSnap.data().state;
      if (cloudState) {
        mergeState(cloudState);
        
        // Re-render views with synced data
        renderBacklog();
        renderHistory();
        renderCompass();
        if (state.currentRoute) {
          renderTimeline();
          setupActiveFocusBlock();
        }
        updateViewVisibility();
        console.log("Cloud sync state loaded.");
      }
    } else {
      // Document does not exist: upload current local state to sync
      await syncStateToCloud();
    }
  } catch (err) {
    console.error("Cloud load failed:", err);
  }
}

function setupFirebaseObservers() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      
      document.getElementById('fb-user-name').textContent = user.displayName || 'GPS Explorer';
      document.getElementById('fb-user-email').textContent = user.email;
      
      const photoEl = document.getElementById('fb-user-photo');
      if (user.photoURL) {
        photoEl.src = user.photoURL;
        photoEl.style.display = 'block';
      } else {
        photoEl.style.display = 'none';
      }
      
      document.getElementById('fb-logged-out-form').style.display = 'none';
      document.getElementById('fb-logged-in-form').style.display = 'block';

      await loadStateFromCloud();
    } else {
      currentUser = null;
      document.getElementById('fb-logged-out-form').style.display = 'block';
      document.getElementById('fb-logged-in-form').style.display = 'none';
    }
  });
}
