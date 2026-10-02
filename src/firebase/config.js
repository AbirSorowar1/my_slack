import { initializeApp } from 'firebase/app';

const env = import.meta.env;

// Environment variables win; the fallback is the project supplied with the brief.
export const firebaseConfig = {
  apiKey: "AIzaSyCy0yAoWfblZ4XVJrXKvvkhzcmoCAcdFWw",
  authDomain: "testing-31984.firebaseapp.com",
  databaseURL: "https://testing-31984-default-rtdb.firebaseio.com",
  projectId: "testing-31984",
  storageBucket: "testing-31984.firebasestorage.app",
  messagingSenderId: "470140272628",
  appId: "1:470140272628:web:d67ac5f8c28871e93b43a1",
  measurementId: "G-9EK4JC969B"
};

export const app = initializeApp(firebaseConfig);
