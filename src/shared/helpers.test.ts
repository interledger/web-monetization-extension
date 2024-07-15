import { addDays, addMonths, addSeconds } from 'date-fns'
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
  const dateJan = new Date('2024-01-03T00:00:00.000Z')
  const dateFeb = new Date('2023-02-03T00:00:00.000Z')
  const dateFebLeap = new Date('2024-02-29T00:00:00.000Z')
  const dateApr = new Date('2024-04-03T00:00:00.000Z')

  it('should return the next occurrence with /P1M', () => {
    expect(
      getNextOccurrence(`R/${dateJan.toISOString()}/P1M`, dateJan)
    ).toEqual(addMonths(dateJan, 1))
    expect(
      getNextOccurrence(`R/${dateFeb.toISOString()}/P1M`, dateFeb)
    ).toEqual(addMonths(dateFeb, 1))
    expect(
      getNextOccurrence(`R/${dateFebLeap.toISOString()}/P1M`, dateFebLeap)
    ).toEqual(addMonths(dateFebLeap, 1))
    expect(
      getNextOccurrence(`R/${dateApr.toISOString()}/P1M`, dateApr)
    ).toEqual(addMonths(dateApr, 1))
  })

  it('should return next occurrence with /P1W', () => {
    expect(
      getNextOccurrence(`R/${dateJan.toISOString()}/P1W`, dateJan)
    ).toEqual(addDays(dateJan, 7))
    expect(
      getNextOccurrence(`R/${dateFeb.toISOString()}/P1W`, dateFeb)
    ).toEqual(addDays(dateFeb, 7))
    expect(
      getNextOccurrence(`R/${dateFebLeap.toISOString()}/P1W`, dateFebLeap)
    ).toEqual(addDays(dateFebLeap, 7))
    expect(
      getNextOccurrence(`R/${dateApr.toISOString()}/P1W`, dateApr)
    ).toEqual(addDays(dateApr, 7))
  })

  it('should throw if no more occurrences are possible', () => {
    const interval = `R1/${dateJan.toISOString()}/P1M`
    const errorMsg = /No next occurrence is possible/

    expect(() =>
      getNextOccurrence(interval, addMonths(dateJan, 0))
    ).not.toThrow(errorMsg)
    expect(() => getNextOccurrence(interval, addDays(dateJan, 10))).not.toThrow(
      errorMsg
    )

    expect(() => getNextOccurrence(interval, addMonths(dateJan, 1))).toThrow(
      errorMsg
    )
    expect(() => getNextOccurrence(interval, addMonths(dateJan, 2))).toThrow(
      errorMsg
    )
  })

  it('should return the next occurrence with /PT', () => {
    expect(getNextOccurrence(`R/${nowISO}/PT30S`, now)).toEqual(
      addSeconds(now, 30)
    )
  })
})
