
class OpenDB {
    constructor(dbName, storeName, storeOptions) {
        if (typeof indexedDB === 'undefined') {
            throw new Error("Your browser doesn't support IndexedDB");
        }
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

    open() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName);
            request.onerror = () => {
                //console.log('open onerror');
                resolve();
            };
            request.onsuccess = () => {
                //console.log('open onsuccess');
                resolve(request.result);
            };
            request.onupgradeneeded = () => {
                //console.log('open onupgradeneeded');
                const db = request.result;
                const store = db.createObjectStore(this.storeName, {
                    ... this.storeOptions
                });
                store.transaction.oncomplete = () => {
                    resolve(db);
                };
            };
        });
    }

    async promisedRequest(rw, handler) {
        if (!this.db) {
            this.db = await this.open();
        }
        return new Promise((resolve) => {
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                resolve({
                    error: new Error(`Not found store: ${this.storeName}`)
                });
                return;
            }
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
        return this.putItem(value, key);
    }

    //==========================================================

    async getItem(key) {
        const response = await this.promisedRequest('readonly', (store) => {
            return store.get(key);
        });

        if (response.error) {
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
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

export const deleteDB = (dbName = 'db') => {
    return indexedDB.deleteDatabase(dbName);
};

export const openDB = (dbName = 'db', storeName = 'store', storeOptions = {}) => {
    return new OpenDB(dbName, storeName, storeOptions);
};

export default openDB;
