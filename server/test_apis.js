import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGroq } from '@langchain/groq';
import { NomicEmbeddings } from '@langchain/nomic';
import { YoutubeTranscript } from 'youtube-transcript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runTests() {
  console.log('🧪 Starting API Verification Tests...\n');
  let allPassed = true;

  // 1. Test Groq LLM
  try {
    process.stdout.write('⏳ Testing Groq LLM (llama-3.3-70b-versatile)... ');
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      maxTokens: 10,
    });
    const res = await llm.invoke('Say the word "OK"');
    if (res.content.toLowerCase().includes('ok')) {
      console.log('✅ PASSED');
    } else {
      console.log('❌ FAILED (Unexpected response: ' + res.content + ')');
      allPassed = false;
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
    allPassed = false;
  }

  // 2. Test Nomic Embeddings
  try {
    process.stdout.write('⏳ Testing Nomic Embeddings (nomic-embed-text-v1.5)... ');
    const embeddings = new NomicEmbeddings({
      apiKey: process.env.NOMIC_API_KEY,
      modelName: 'nomic-embed-text-v1.5',
    });
    const res = await embeddings.embedQuery('Hello world');
    if (Array.isArray(res) && res.length > 0) {
      console.log(`✅ PASSED (Vector length: ${res.length})`);
    } else {
      console.log('❌ FAILED (Invalid response format)');
      allPassed = false;
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
    allPassed = false;
  }

  // 3. Test YouTube Transcript API
  try {
    process.stdout.write('⏳ Testing YouTube Transcript API... ');
    const res = await YoutubeTranscript.fetchTranscript('https://www.youtube.com/watch?v=jNQXAC9IVRw'); // First YouTube video
    if (Array.isArray(res) && res.length > 0) {
      console.log(`✅ PASSED (Fetched ${res.length} segments)`);
    } else {
      console.log('❌ FAILED (Empty transcript)');
      allPassed = false;
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
    allPassed = false;
  }

  console.log('\n=======================================');
  if (allPassed) {
    console.log('🎉 ALL EXTERNAL APIS ARE WORKING PERFECTLY!');
  } else {
    console.log('⚠️ SOME TESTS FAILED. PLEASE CHECK THE ERRORS ABOVE.');
  }
  console.log('=======================================');
  process.exit(allPassed ? 0 : 1);
}

runTests();
