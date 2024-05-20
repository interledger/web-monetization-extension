import { formatNumber } from './utils'

describe('formatNumber', () => {
  it('should display right format for integers', () => {
    let res = formatNumber(5, 2)
    expect(res).toEqual('5.00')

    res = formatNumber(5, 4)
    expect(res).toEqual('5.00')

    res = formatNumber(5, 9)
    expect(res).toEqual('5.00')
  })

  it('should display right format for real numbers bigger than 1', () => {
    let res = formatNumber(5.9, 2)
    expect(res).toEqual('5.90')

    res = formatNumber(5.09, 4)
    expect(res).toEqual('5.09')

    res = formatNumber(5.009, 4)
    expect(res).toEqual('5.009')

    res = formatNumber(5.0009, 4)
    expect(res).toEqual('5.0009')

    res = formatNumber(5.000009, 9)
    expect(res).toEqual('5.000009')

    res = formatNumber(5.000000009, 9)
    expect(res).toEqual('5.000000009')
  })

  it('should display right format for real numbers smaller than 1', () => {
    let res = formatNumber(0.09, 2)
    expect(res).toEqual('0.09')

    res = formatNumber(0.0009, 4)
    expect(res).toEqual('0.0009')

    res = formatNumber(0.000000009, 9)
    expect(res).toEqual('9e-9')

    res = formatNumber(0.00009, 9)
    expect(res).toEqual('9e-5')

    res = formatNumber(0.0000109, 9)
    expect(res).toEqual('1.09e-5')

    res = formatNumber(0.000010009, 9)
    expect(res).toEqual('1.0009e-5')

    res = formatNumber(0.000100009, 9)
    expect(res).toEqual('0.000100009')
  })
})
