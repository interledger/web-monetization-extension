type AsyncFn<T> = (...args: any[]) => Promise<T>

interface CacheEntry {
    promise: Promise<any>
}

interface DedupeOptions {
    cacheFnArgs: boolean
}

export class Deduplicator {
    private cache: Map<string, CacheEntry> = new Map()

    constructor(private duration = 5000) { }

    dedupe<T extends AsyncFn<any>>(
        fn: T,
        options: DedupeOptions = { cacheFnArgs: false }
    ): T {
        return ((...args: Parameters<T>): ReturnType<T> => {
            const key = this.generateCacheKey(fn, args, options.cacheFnArgs)
            const entry = this.cache.get(key)

            if (entry) {
                console.log('Deduping', fn.name)
                return entry.promise as ReturnType<T>
            }

            const promise = fn(...args)
            this.cache.set(key, { promise })

            promise
                .then((res) => {
                    this.cache.set(key, { promise: Promise.resolve(res) })
                    return res;
                })
                .catch((err) => {
                    throw err
                })
                .finally(() => this.scheduleCacheClear(key))

            console.log(promise)

            return promise as ReturnType<T>
        }) as unknown as T
    }

    private generateCacheKey<T>(
        fn: AsyncFn<T>,
        args: any[],
        cacheFnArgs: boolean
    ): string {
        let key = fn.name
        if (cacheFnArgs) {
            key += `_${JSON.stringify(args)}`
        }
        return key
    }

    private scheduleCacheClear(key: string): void {
        setTimeout(() => {
            const entry = this.cache.get(key)
            console.log(Object.fromEntries(this.cache.entries()))
            if (entry) this.cache.delete(key)
        }, this.duration)
    }
}
