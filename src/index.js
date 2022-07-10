const openedMap = new Map();

const assertIndexedDB = () => {
    if (typeof indexedDB === 'undefined') {
        throw new Error("Your browser doesn't support indexedDB");
    }
};

const getNewVersion = (db) => {
    return parseInt(db.version) + 1;
};

export const closeDB = (dbName) => {
    const db = openedMap.get(dbName);
    if (db) {
        db.close();
        openedMap.delete(dbName);
    }
};
class OpenDB {
    constructor(dbName, storeName, storeOptions) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.storeOptions = this.initStoreOptions(storeOptions);
    }

    initStoreOptions(storeOptions) {
        if (!storeOptions) {
            return {};
        }

        if (typeof storeOptions === 'string') {
            return {
                keyPath: storeOptions
            };
        }

        if (storeOptions === true) {
            return {
                autoIncrement: true
            };
        }

        if (typeof storeOptions === 'object') {
            return storeOptions;
        }

        return {};
    }

    //==========================================================

    open(upgradeHandler, version) {
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
                upgradeHandler(request.result);
            };
        });
    }

    async init() {
        if (this.db) {
            return this;
        }

        const upgradeHandler = (db) => {
            db.createObjectStore(this.storeName, {
                ... this.storeOptions
            });
        };

        const db = await this.open(upgradeHandler);
        if (db.objectStoreNames.contains(this.storeName)) {
            this.db = db;
            return this;
        }

        this.db = await this.open(upgradeHandler, getNewVersion(db));
        return this;
    }

    //==========================================================

    storeNames() {
        return Array.from(this.db.objectStoreNames);
    }

    hasStore(storeName) {
        return this.db.objectStoreNames.contains(storeName);
    }

    async deleteStore(storeName) {
        if (!storeName || typeof storeName !== 'string') {
            return;
        }
        if (storeName === this.storeName) {
            //can not delete current store
            return;
        }
        if (!this.hasStore(storeName)) {
            return;
        }

        const upgradeHandler = (db) => {
            db.deleteObjectStore(storeName);
        };

        this.db = await this.open(upgradeHandler, getNewVersion(this.db));
    }

    async createStore(storeName, storeOptions) {
        if (!storeName || typeof storeName !== 'string') {
            return;
        }
        if (this.hasStore(storeName)) {
            return;
        }
        this.close();
        this.storeName = storeName;
        this.storeOptions = this.initStoreOptions(storeOptions);

        const upgradeHandler = (db) => {
            db.createObjectStore(this.storeName, {
                ... this.storeOptions
            });
        };

        this.db = await this.open(upgradeHandler, getNewVersion(this.db));
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

    //==========================================================

    promisedRequest(rw, handler) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(this.storeName, rw);
            const store = transaction.objectStore(this.storeName);
            const request = handler(store);
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

    //==========================================================

    addItem(value, key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.add(value, key);
        });
    }

    putItem(value, key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.put(value, key);
        });
    }

    //==========================================================

    setItem(key, value) {
        //in-line keys if keyPath
        if (this.storeOptions.keyPath) {
            return this.putItem(key);
        }
        return this.putItem(value, key);
    }

    //==========================================================

    async getItem(key) {
        const response = await this.promisedRequest('readonly', (store) => {
            return store.get(key);
        });

        if (response.error) {
            console.error(response.error);
            return;
        }
        return response.result;
    }

    //==========================================================

    removeItem(key) {
        return this.promisedRequest('readwrite', (store) => {
            return store.delete(key);
        });
    }

    //==========================================================

    clear() {
        return this.promisedRequest('readwrite', (store) => {
            return store.clear();
        });
    }

    close() {
        closeDB(this.dbName);
        this.db = null;
    }
}

//===========================================================================================

export const dbs = () => {
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

export const openDB = (dbName = 'db', storeName = 'store', storeOptions = {}) => {
    assertIndexedDB();
    if (!dbName || typeof dbName !== 'string') {
        return;
    }
    if (!storeName || typeof storeName !== 'string') {
        return;
    }
    const odb = new OpenDB(dbName, storeName, storeOptions);
    return odb.init();
};

export default openDB;
