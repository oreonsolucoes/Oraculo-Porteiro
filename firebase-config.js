// ============================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyDvvW3MMxvVNb7PyhYbaR3mdsygfcy0Ghw",
  authDomain: "oraculo-v1.firebaseapp.com",
  projectId: "oraculo-v1",
  storageBucket: "oraculo-v1.firebasestorage.app",
  messagingSenderId: "1052381946693",
  appId: "1:1052381946693:web:50f57501024c28e8f3142c",
  measurementId: "G-K2DQPQEPSC"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database(app);

// Exportar para uso global
window.firebaseApp = app;
window.firebaseDb = db;

console.log("✅ Firebase inicializado com sucesso!");
