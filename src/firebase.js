// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // 這是多人即時同步的核心

const firebaseConfig = {
    apiKey: "AIzaSyCmW4TD09k7Q-HjoTCREQWbVTTBl3l5bx4",
    authDomain: "artale-template.firebaseapp.com",
    // 注意：如果你的 Firebase 面板有提供 databaseURL，請補在這裡
    // 通常格式為 https://artale-template-default-rtdb.firebaseio.com/
    databaseURL: "https://artale-template-default-rtdb.firebaseio.com",
    projectId: "artale-template",
    storageBucket: "artale-template.firebasestorage.app",
    messagingSenderId: "841190273729",
    appId: "1:841190273729:web:fc1628dc94da4f46bcda40",
    measurementId: "G-7Z4XFPSD84"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 導出資料庫實例，讓 App.jsx 可以直接使用
export const db = getDatabase(app);