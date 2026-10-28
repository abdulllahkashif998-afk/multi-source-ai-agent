// All document persistence now passes through the transactional lifecycle service.
// Storage paths are generated internally rather than accepted from callers.
export { ingestDocument as storeDocument } from './document-lifecycle';
