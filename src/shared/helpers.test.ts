import { objectEquals } from './helpers'

describe('objectEquals', () => {
  it('should return true if objects are equal', () => {
    expect(objectEquals({}, {})).toBe(true)
    expect(objectEquals({ a: 1 }, { a: 1 })).toBe(true)
    expect(objectEquals({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true)
    expect(objectEquals({ a: 1 }, { a: 1, b: undefined })).toBe(true)
  })

  it('should return false if objects are not equal', () => {
    expect(objectEquals({ a: 1 }, { a: 2 })).toBe(false)
    expect(objectEquals({ a: 1 }, { b: 1 })).toBe(false)
  })
})
