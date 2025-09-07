// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// 👇 Aquí pega tu configuración real de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyATr85f8V8ad2wD1XF9_bAz300Gqm9cD9A",
  authDomain: "mi-app-estudio.firebaseapp.com",
  projectId: "mi-app-estudio",
  storageBucket: "mi-app-estudio.firebasestorage.app",
  messagingSenderId: "111296629187",
  appId: "1:111296629187:web:9f17808232364195711e8",
  measurementId: "G-98E7BMMK8"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar instancias
export const db = getFirestore(app);
export const auth = getAuth(app);

// Iniciar sesión anónima automáticamente
signInAnonymously(auth).catch(console.error);
