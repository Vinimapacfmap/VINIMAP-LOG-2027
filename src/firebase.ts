import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';

console.log('[Firebase Service Init] Diagnóstico de inicialização do serviço Firebase:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firestoreDatabaseId,
  hasApiKey: Boolean(firebaseConfig.apiKey),
  appId: firebaseConfig.appId,
  timestamp: new Date().toISOString()
});

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore explicitly targeting the databaseId configured in firebase-applet-config.json
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

const auth = getAuth(app);

async function testConnection() {
  try {
    console.log(`[Firestore Diagnóstico] Iniciando teste de conectividade com o banco '${firestoreDatabaseId}'...`);
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log(`[Firestore Diagnóstico] ✅ Conexão estabelecida e confirmada com sucesso no Firestore database '${firestoreDatabaseId}'!`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.warn("[Firestore Diagnóstico] ⚠️ O cliente está offline ou sem conexão de rede.");
      } else if (error.message.includes('permission-denied') || error.message.includes('insufficient permissions')) {
        console.info("[Firestore Diagnóstico] ℹ️ Conexão ativa com Firestore verificada (servidor respondeu às regras de segurança).");
      } else {
        console.warn("[Firestore Diagnóstico] ⚠️ Resposta da verificação de conexão:", error.message);
      }
    } else {
      console.warn("[Firestore Diagnóstico] ⚠️ Erro não tratado durante o teste de conexão:", error);
    }
  }
}

testConnection();

export { app, db, auth };




