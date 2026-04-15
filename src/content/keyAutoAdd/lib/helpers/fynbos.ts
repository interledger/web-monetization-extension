// Remix/React Router .data endpoint response (based on turbo-stream).
// Looks like: [{"_1":2,"_45":46},"root",{"_3":4},"data",{"_5":6,"_7":8
export type RemixData = unknown[];

type RootData = { root: { data: unknown } };
type RouteData = Record<string, { data: unknown }>;

export function decodeReactRouterData<T extends RouteData>(
  data: RemixData,
): T & RootData {
  // to prevent "Too much recursion"
  const cache = new Map();

  function resolve(index: unknown) {
    if (index === null || typeof index !== 'number') return index;

    if (cache.has(index)) return cache.get(index);

    const val = data[index];
    if (val === null || typeof val !== 'object') {
      return val;
    }

    if (Array.isArray(val)) {
      // Handle Class Instances: ["SingleFetchClassInstance", 50]
      if (val[0] === 'SingleFetchClassInstance') {
        return resolve(val[1]);
      }
      // Handle BigInt/Special types: ["B", "5060"]
      if (val[0] === 'B') {
        return val[1];
      }
      // Regular Arrays
      const arr: unknown[] = [];
      cache.set(index, arr);
      val.forEach((itemIndex) => {
        arr.push(resolve(itemIndex));
      });
      return arr;
    }

    // Handle Objects: {"_51": 34, "_52": 53}
    const obj = Object.create(null);
    cache.set(index, obj);

    for (const [key, pointer] of Object.entries(val)) {
      if (key.startsWith('_')) {
        const actualKeyName = data[Number.parseInt(key.substring(1), 10)];
        obj[actualKeyName as string] = resolve(pointer);
      } else {
        obj[key] = resolve(pointer);
      }
    }

    return obj;
  }

  return resolve(0);
}
