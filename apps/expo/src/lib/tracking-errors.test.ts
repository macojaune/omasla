import { describe, expect, it } from "vitest"

import { isTransientLocationError } from "./tracking-model"

describe("isTransientLocationError", () => {
  it("ignores iOS « location unknown » while acquiring a fix", () => {
    expect(
      isTransientLocationError({
        code: 0,
        message: 'Error Domain=kCLErrorDomain Code=0 "(null)"',
      }),
    ).toBe(true)
  })
  it("still treats a denied permission as a failure", () => {
    expect(
      isTransientLocationError({
        code: 1,
        message: 'Error Domain=kCLErrorDomain Code=1 "(null)"',
      }),
    ).toBe(false)
  })
  it("treats unknown or missing errors as failures", () => {
    expect(isTransientLocationError({ code: 0, message: "Other" })).toBe(false)
    expect(isTransientLocationError(null)).toBe(false)
  })
})
