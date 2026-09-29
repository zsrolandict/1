/**
 * Szándékosan a felhasználónak szóló hiba (magyar, érthető szöveg). Az API
 * csak ennek az üzenetét adja vissza; minden más hiba részlete csak a
 * szervernaplóba kerül (lásd app/api/_errors.ts).
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
