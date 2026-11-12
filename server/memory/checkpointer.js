import { MemorySaver } from '@langchain/langgraph';

// Singleton MemorySaver — persists graph state in memory per thread_id
// thread_id = session._id (MongoDB ObjectId string)
// Each session gets its own isolated state channel in the saver
let _checkpointer = null;

export const getCheckpointer = () => {
  if (!_checkpointer) {
    _checkpointer = new MemorySaver();
    console.log('✅ LangGraph MemorySaver checkpointer initialized (short-term memory)');
  }
  return _checkpointer;
};
