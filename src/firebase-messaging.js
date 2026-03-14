// src/firebase-messaging.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyANI1nMfarUwm08XwccpVg8zqSsAqZjytA",
  authDomain: "smartagri-62ae1.firebaseapp.com",
  projectId: "smartagri-62ae1",
  storageBucket: "smartagri-62ae1.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const requestFirebaseNotificationPermission = async () => {
  try {
    const token = await getToken(messaging, {
      vapidKey: "YOUR_PUBLIC_VAPID_KEY",
    });
    console.log("FCM Token:", token);
    return token;
  } catch (error) {
    console.error("Permission denied", error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });