const openedMap = new Map();

export const closeDB = (dbName) => {
    const db = openedMap.get(dbName);
    if (db) {
        db.close();
        openedMap.delete(dbName);
    }
};
export class OpenDB {
    constructor(dbName = 'db', storeName = 'store', storeOptions = {}) {
        if (typeof dbName !== 'string' || !dbName) {
            throw new Error('dbName is required');
        }
        if (typeof storeName !== 'string' || !storeName) {
            throw new Error('storeName is required');
        }
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

    open(version) {
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
                request.result.createObjectStore(this.storeName, {
                    ... this.storeOptions
                });
            };
        });
    }

    async init() {
        if (this.db) {
            return;
        }

        const db = await this.open();
        if (db.objectStoreNames.contains(this.storeName)) {
            this.db = db;
            return;
        }

        const newVersion = parseInt(db.version) + 1;
        //console.log(db.version, newVersion);
        closeDB(this.dbName);
        this.db = await this.open(newVersion);
    }

    async promisedRequest(rw, handler) {
        await this.init();
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
const indexedDBError = new Error("Your browser doesn't support indexedDB");

export const dbs = () => {
    if (typeof indexedDB === 'undefined') {
        throw indexedDBError;
    }
    return indexedDB.databases();
};

export const deleteDB = (dbName = 'db') => {
    if (typeof indexedDB === 'undefined') {
        throw indexedDBError;
    }
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

export const openDB = async (dbName, storeName, storeOptions) => {
    if (typeof indexedDB === 'undefined') {
        throw indexedDBError;
    }
    const odb = new OpenDB(dbName, storeName, storeOptions);
    await odb.init();
    return odb;
};

export default openDB;
