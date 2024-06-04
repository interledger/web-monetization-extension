import { OpenPaymentsService } from "./openPayments";

type AsyncFn<T> = (...args: any[]) => Promise<T>

type CacheEntry = {
    timestamp: number,
    promise: Promise<any>
}

export class TokenService {
    private cache: Map<string, CacheEntry> = new Map();
    private timeout: number = 1000 //ms

    constructor(private openPayments: OpenPaymentsService) {}

    async rotate() {}

    private dedupe<T>(fn: AsyncFn<T>): AsyncFn<T> {
        return (...args: any[]): Promise<T> => {
            const key = this.generateKey(fn, args)
            const now = Date.now();

            const entry = this.cache.get(key);

            if (entry && now - entry.timestamp < this.timeout) {
                return entry.promise;
            }

            const promise = fn(...args)
                .then((result) => {
                    this.cache.set(key, {
                        timestamp: Date.now(),
                        promise: Promise.resolve(result)
                    })
                    return result
                })
                .catch((error) => {
                    throw error;
                })
                .finally(() => {
                    this.scheduleCacheClear(key)
                })

            this.cache.set(key, {
                timestamp: now,
                promise
            })

            return promise;
        }
    }

    private scheduleCacheClear(key: string): void {
        setTimeout(() => {
            const entry = this.cache.get(key);
            if (entry) this.cache.delete(key)
        }, this.timeout)
    }

    private generateKey<T>(fn: AsyncFn<T>, args: any[]): string {
        return `${fn.toString()}_${JSON.stringify(args)}`
    }
}
