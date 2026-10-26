// For Firebase JS SDK v7.20.0 and later, measurementId is optional
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyD-TFHvpd7ONxGLx5CdNKdHRNltGhgknp4",
  authDomain: "fruitguard-87844.firebaseapp.com",
  databaseURL: "https://fruitguard-87844-default-rtdb.firebaseio.com",
  projectId: "fruitguard-87844",
  storageBucket: "fruitguard-87844.firebasestorage.app",
  messagingSenderId: "869653948787",
  appId: "1:869653948787:web:9660f6fc3735ee3a33bd06",
  measurementId: "G-6LPET0898T"
};
const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const auth = getAuth(app);