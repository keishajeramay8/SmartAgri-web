import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyANI1nMfarUwm08XwccpVg8zqSsAqZjytA",
  authDomain: "smartagri-62ae1.firebaseapp.com",
  databaseURL: "https://smartagri-62ae1-default-rtdb.firebaseio.com",
  projectId: "smartagri-62ae1",
  storageBucket: "smartagri-62ae1.appspot.com",
  messagingSenderId: "536057132104",
  appId: "1:536057132104:web:4fa6289aa595dec27b547d",
  measurementId: "G-FVCNR88T6C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);