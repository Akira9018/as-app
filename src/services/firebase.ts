// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics (optional - only in production)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Development environment setup
if (process.env.NODE_ENV === 'development') {
    // Emulator接続（開発時のみ）
    try {
        // Auth emulator
        if (!auth.emulatorConfig) {
            connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        }

        // Firestore emulator
        if (!db._delegate._databaseId.projectId.includes('localhost')) {
            connectFirestoreEmulator(db, 'localhost', 8080);
        }

        // Storage emulator
        if (!storage._location.bucket.includes('localhost')) {
            connectStorageEmulator(storage, 'localhost', 9199);
        }
    } catch (error) {
        console.log('Emulator connection failed:', error);
    }
}

export default app;