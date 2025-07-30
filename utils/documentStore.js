// In-memory document store
const documentStore = new Map();

// Utility function to clean up old documents
const cleanupOldDocuments = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, doc] of documentStore.entries()) {
    if (doc.uploadedAt < oneHourAgo) {
      documentStore.delete(id);
    }
  }
};

// Start cleanup interval
setInterval(cleanupOldDocuments, 60 * 60 * 1000);

// Document store operations
const addDocument = (id, document) => {
  documentStore.set(id, document);
};

const getDocument = (id) => {
  return documentStore.get(id);
};

const hasDocument = (id) => {
  return documentStore.has(id);
};

const deleteDocument = (id) => {
  return documentStore.delete(id);
};

const getDocumentCount = () => {
  return documentStore.size;
};

const getAllDocuments = () => {
  return Array.from(documentStore.entries());
};

module.exports = {
  addDocument,
  getDocument,
  hasDocument,
  deleteDocument,
  getDocumentCount,
  getAllDocuments,
  cleanupOldDocuments,
}; 