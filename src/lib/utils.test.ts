import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  it('should merge single class strings', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('should merge multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes with objects', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar')
  })

  it('should handle arrays of classes', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('should handle undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('should merge conflicting Tailwind classes correctly', () => {
    // tailwind-merge should resolve conflicts
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('should handle empty input', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  it('should handle complex nested conditions', () => {
    const result = cn(
      'base-class',
      ['array-class-1', 'array-class-2'],
      { 'conditional-true': true },
      { 'conditional-false': false },
      undefined,
      null,
    )
    expect(result).toBe('base-class array-class-1 array-class-2 conditional-true')
  })

  it('should properly merge padding classes', () => {
    expect(cn('p-4', 'px-6')).toBe('p-4 px-6')
    expect(cn('p-4', 'p-6')).toBe('p-6')
  })

  it('should properly merge margin classes', () => {
    expect(cn('m-4', 'mx-6')).toBe('m-4 mx-6')
    expect(cn('m-4', 'm-6')).toBe('m-6')
  })

  it('should handle responsive prefixes', () => {
    expect(cn('text-sm', 'md:text-lg')).toBe('text-sm md:text-lg')
  })

  it('should handle hover states', () => {
    expect(cn('bg-blue-500', 'hover:bg-blue-600')).toBe('bg-blue-500 hover:bg-blue-600')
  })
})
