import { getNextSendableAmount } from './utils'

// same as BuiltinIterator.take(n)
function take<T>(iter: IterableIterator<T>, n: number) {
  const result: T[] = []
  for (let i = 0; i < n; i++) {
    const item = iter.next()
    if (item.done) break
    result.push(item.value)
  }
  return result
}

describe('getNextSendableAmount', () => {
  it('from assetScale 8 to 9', () => {
    const min = 990_00_000n / 3600n // 0.99XPR per hour == 0.000275 XRP per second (27500 at scale 8)
    expect(take(getNextSendableAmount(8, 9, min), 8)).toEqual([
      '27500',
      '27501',
      '27502',
      '27504',
      '27508',
      '27515',
      '27527',
      '27547'
    ])
  })

  it('from assetScale 8 to 2', () => {
    const min = 990_00_000n / 3600n
    expect(take(getNextSendableAmount(8, 2, min), 8)).toEqual([
      '27500',
      '1027500',
      '2027500',
      '4027500',
      '8027500',
      '15027500',
      '27027500',
      '47027500'
    ])
  })

  it('from assetScale 3 to 2', () => {
    expect(take(getNextSendableAmount(3, 2), 8)).toEqual([
      '10',
      '20',
      '40',
      '80',
      '150',
      '270',
      '470',
      '800'
    ])
  })

  it('from assetScale 2 to 3', () => {
    expect(take(getNextSendableAmount(2, 3), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80'
    ])
  })

  it('from assetScale 2 to 2', () => {
    expect(take(getNextSendableAmount(2, 2), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80'
    ])
  })
})
