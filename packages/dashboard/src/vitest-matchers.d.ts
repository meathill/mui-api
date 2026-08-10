import '@vitest/expect';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module '@vitest/expect' {
  interface Assertion<T> extends TestingLibraryMatchers<Assertion<T>, T> {}
}
