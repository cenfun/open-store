const openedMap = new Map();

const assertIndexedDB = () => {
    if (typeof indexedDB === 'undefined') {
        throw new Error("Your browser doesn't support indexedDB");
    }
};

const closeDB = (dbName) => {
    const db = openedMap.get(dbName);
    if (db) {
        db.close();
        openedMap.delete(dbName);
    }
};

//===========================================================================================
class OpenDB {
    constructor(dbName, storeName, options) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.initStoreOptions(options);
    }

    initStoreOptions(options) {
        this.storeOptions = {};
        this.indexOptions = null;

        if (!options) {
            return;
        }

        if (typeof options === 'string') {
            this.storeOptions = {
                keyPath: options
            };
            return;
        }

        if (typeof options === 'boolean') {
            this.storeOptions = {
                autoIncrement: true
            };
            return;
        }

        if (typeof options === 'object') {
            this.initObjectStoreOptions(options);
        }

    }

    initObjectStoreOptions(options) {
        if (typeof options.keyPath === 'string' && options.keyPath) {
            this.storeOptions.keyPath = options.keyPath;
        }
        if (options.autoIncrement) {
            this.storeOptions.autoIncrement = true;
        }
        if (typeof options.index === 'object' && options.index) {
            this.indexOptions = options.index;
        }
    }

    //===========================================================================================

    open(handler, version) {
        return new Promise((resolve) => {
            closeDB(this.dbName);
            const request = indexedDB.open(this.dbName, version);
            request.onerror = (e) => {
                //console.log('open onerror');
                //console.error(e);
                resolve();
            };
            request.onblocked = (e) => {
                //console.log('open onblocked');
                //console.error(e);
                resolve();
            };
            request.onsuccess = () => {
                //console.log('open onsuccess');
                const db = request.result;
                openedMap.set(this.dbName, db);
                resolve(db);
            };
            request.onupgradeneeded = () => {
                //console.log('open onupgradeneeded');
                handler.call(this, request.result);
            };
        });
    }

    async upgrade(handler) {
        const newVersion = parseInt(this.db.version) + 1;
        this.db = await this.open(handler, newVersion);
    }

    async init() {
        if (this.db) {
            return this;
        }

        this.db = await this.open(this.createStoreHandler);
        if (this.db.objectStoreNames.contains(this.storeName)) {
            return this;
        }

        await this.upgrade(this.createStoreHandler);

        return this;
    }

    createStoreHandler(db) {
        const store = db.createObjectStore(this.storeName, this.storeOptions);
        //create index
        if (!this.indexOptions) {
            return;
        }

        Object.keys(this.indexOptions).forEach((indexKey) => {
            const option = this.indexOptions[indexKey];
            const indexName = this.indexNameHandler(indexKey);
            store.createIndex(indexName, indexKey, option);
        });
    }

    indexNameHandler(indexKey) {
        if (indexKey && typeof indexKey === 'string') {
            return `by_${indexKey}`;
        }
    }

    //===========================================================================================

    getCurrentStore(rw = 'readonly') {
        return this.db.transaction(this.storeName, rw).objectStore(this.storeName);
    }

    promisedRequest(rw, handler) {
        return new Promise((resolve) => {
            const store = this.getCurrentStore(rw);
            const request = handler.call(this, store);
            request.onsuccess = function(e) {
                //console.log('set onsuccess');
                resolve({
                    result: request.result
                });
            };
            request.onerror = function(e) {
                //console.log('set onerror');
                resolve({
                    error: request.error
                });
            };
        });
    }

    //===========================================================================================
    //store API

    hasStore(storeName) {
        return this.db.objectStoreNames.contains(storeName);
    }

    async deleteStore(storeName) {
        if (!storeName || typeof storeName !== 'string') {
            return;
        }
        if (!this.hasStore(storeName)) {
            return;
        }
        await this.upgrade((db) => {
            db.deleteObjectStore(storeName);
        });
    }

    async createStore(storeName, options) {
        if (!storeName || typeof storeName !== 'string') {
            return;
        }
        if (this.hasStore(storeName)) {
            return;
        }
        this.storeName = storeName;
        this.initStoreOptions(options);
        await this.upgrade(this.createStoreHandler);
    }

    useStore(storeName) {
        if (!storeName || typeof storeName !== 'string') {
            return;
        }
        if (!this.hasStore(storeName)) {
            return;
        }
        this.storeName = storeName;
    }

    getStoreNames() {
        return Array.from(this.db.objectStoreNames);
    }

    //===========================================================================================
    //data API

    add(value, key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.add(value, key);
        });
    }

    put(value, key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.put(value, key);
        });
    }

    //==========================================================

    delete(key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.delete(key);
        });
    }

    //==========================================================

    set(key, value) {
        //in-line keys if keyPath
        if (this.storeOptions.keyPath) {
            return this.put(key);
        }
        return this.put(value, key);
    }

    //==========================================================

    async get(key, indexKey) {
        const response = await this.promisedRequest('readonly', (store) => {
            const indexName = this.indexNameHandler(indexKey);
            if (indexName) {
                if (store.indexNames.contains(indexName)) {
                    return store.index(indexName).get(key);
                }
            }
            return store.get(key);
        });

        if (response.error) {
            console.error(response.error);
            return;
        }
        return response.result;
    }

    //==========================================================

    async getAll(query, count) {
        const response = await this.promisedRequest('readonly', (store) => {
            return store.getAll(query, count);
        });
        if (response.error) {
            console.error(response.error);
            return [];
        }
        return response.result;
    }

    //==========================================================

    each(handler) {
        return new Promise((resolve) => {
            const store = this.getCurrentStore();
            //console.log('store', store);
            const request = store.openCursor();
            //console.log('request', request);
            let index = 0;
            request.onsuccess = (e) => {
                //console.log('onsuccess');
                const cursor = e.target.result;
                if (cursor) {
                    handler.call(this, cursor.value, index, cursor);
                    index += 1;
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => {
                resolve();
            };
        });
    }

    //==========================================================
    async count() {
        const response = await this.promisedRequest('readonly', (store) => {
            return store.count();
        });
        if (response.error) {
            console.error(response.error);
            return;
        }
        return response.result;
    }

    //==========================================================

    clear() {
        return this.promisedRequest('readwrite', (store) => {
            return store.clear();
        });
    }

    //==========================================================

    close() {
        closeDB(this.dbName);
        this.db = null;
    }

}

//===========================================================================================

export const getDBs = () => {
    assertIndexedDB();
    return indexedDB.databases();
};

export const deleteDB = (dbName = 'db') => {
    assertIndexedDB();
    return new Promise((resolve) => {
        closeDB(dbName);
        const request = indexedDB.deleteDatabase(dbName);
        request.onerror = function() {
            //console.error('Error deleting database');
            resolve(request.error);
        };
        request.onblocked = function() {
            //console.error('Blocked deleting database');
            resolve('blocked on delete database');
        };
        request.onsuccess = function() {
            //console.log('Database deleted');
            resolve();
        };
    });
};

export const openDB = (dbName = 'db', storeName = 'store', options = {}) => {
    assertIndexedDB();
    if (!dbName || typeof dbName !== 'string') {
        return;
    }
    if (!storeName || typeof storeName !== 'string') {
        return;
    }
    const odb = new OpenDB(dbName, storeName, options);
    return odb.init();
};

export default openDB;
