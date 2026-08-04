import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore explicitly targeting the databaseId configured in firebase-applet-config.json
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firestore] Conectado com sucesso ao banco de dados:', firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.warn("[Firestore] O cliente está offline ou sem conexão de rede.");
      } else if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
        console.warn("[Firestore] Permissão negada no documento de teste. Verifique o firestore.rules.");
      } else {
        console.warn("[Firestore] Diagnóstico de conexão:", error.message);
      }
    }
  }
}

testConnection();

export { app, db, auth };



