# open-store
open-store is promised store implemented with IndexedDB.

## Install
```sh
npm i open-store
```
## Usage
```js
import { openStore } from "open-store";

const ost = await openStore();

await ost.set('my-key', 'my-value');
const v = await ost.get('my-key');
console.assert(v === 'my-value');

```

## With custom db name and store name
```js
const ost = await openStore("dbName", "storeName");
```

## With store options
```js
//keyPath is "id"
const ost = await openStore("dbName", "storeName", "id");
//autoIncrement
const ost = await openStore("dbName", "storeName", true);
//or both
const ost = await openStore("dbName", "storeName", {
    keyPath: "id",
    autoIncrement: true
});
```

## With index options
```js
const ost = await openStore("dbName", "storeName", {
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
const v = await ost.get('Tom And Jerry', 'name');
```

## API
```js
// global
import { getDBs, deleteDB, openStore } from "open-store";
getDBs()
deleteDB(dbName)
openStore(dbName = 'db', storeName = 'store', options = {})

// data
ost.add(value, key)
ost.put(value, key)
ost.delete(key)
ost.set(key, value)
ost.get(key, indexKey)
ost.getAll(query, count)
ost.each(handler)
ost.count()
ost.clear()

// store
ost.hasStore(storeName)
ost.deleteStore(storeName)
ost.createStore(storeName, options)
ost.useStore(storeName)
ost.getStoreNames()

// db
ost.close()
```

more example: [public/index.html](public/index.html)