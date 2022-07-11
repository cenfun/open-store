# open-db
open-db is promised store implemented with IndexedDB.

## Install
```sh
npm i open-db
```
## Usage
```js
import { openDB } from "open-db";

const odb = await openDB();

await odb.set('my-key', 'my-value');
const v = await odb.get('my-key');
console.assert(v === 'my-value');

```

## With custom db name and store name
```js
const odb = await openDB("dbName", "storeName");
```

## With store options
```js
//keyPath is "id"
const odb = await openDB("dbName", "storeName", "id");
//autoIncrement
const odb = await openDB("dbName", "storeName", true);
//or both
const odb = await openDB("dbName", "storeName", {
    keyPath: "id",
    autoIncrement: true
});
```

## With index options
```js
const odb = await openDB("dbName", "storeName", {
    index: {
        id: {
            unique: true
        },
        name: {
            unique: false
        }
    }
});

// get value by index name
const v = await odb.get('Tom And Jerry', 'name');
```

## API
```js
// global
import { getDBs, deleteDB, openDB } from "open-db";
getDBs()
deleteDB(dbName)
openDB(dbName = 'db', storeName = 'store', options = {})

// data
odb.add(value, key)
odb.put(value, key)
odb.delete(key)
odb.set(key, value)
odb.get(key, indexKey)
odb.getAll(query, count)
odb.each(handler)
odb.count()
odb.clear()

// store
odb.hasStore(storeName)
odb.deleteStore(storeName)
odb.createStore(storeName, options)
odb.useStore(storeName)
odb.getStoreNames()

// db
odb.close()
```

more example: [public/index.html](public/index.html)