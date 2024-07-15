import {
  isOkState,
  objectEquals,
  removeQueryParams,
  getNextOccurrence
} from './helpers'

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

describe('removeQueryParams', () => {
  it('should remove the query params from the URL', () => {
    expect(removeQueryParams('https://example.com?foo=bar#baz')).toBe(
      'https://example.com/'
    )
  })

  it('should normalize the URL if there are no query params', () => {
    expect(removeQueryParams('https://example.com')).toBe(
      'https://example.com/'
    )
  })
})

describe('isOkState', () => {
  it('should return true if no state is set', () => {
    expect(isOkState({})).toBe(true)
    expect(
      isOkState({ key_revoked: false, missing_host_permissions: false })
    ).toBe(true)
  })

  it('should return false if any state is set', () => {
    expect(
      isOkState({ key_revoked: true, missing_host_permissions: false })
    ).toBe(false)
    expect(
      isOkState({ key_revoked: false, missing_host_permissions: true })
    ).toBe(false)
  })
})

describe('getNextOccurrence', () => {
  const now = new Date()
  const nowISO = now.toISOString()
  const nowVal = now.valueOf()

  it('should return the next occurrence in the array', () => {
    expect(getNextOccurrence(`R/${nowISO}/PT30S`, now)).toEqual(
      new Date(nowVal + 30 * 1000)
    )
  })

  // TODO: more tests
  // `R/${now.toISOString()}/PT1H` // recur unlimited
  // `R3/${now.toISOString()}/PT1M` // recur 3 times
})
