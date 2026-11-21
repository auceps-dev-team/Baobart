import { describe, expect, it } from "vitest";

import { baseLocale } from "./base-locale";

describe("baseLocale", () => {
  it("accepte une base sur ce poste", () => {
    expect(baseLocale("postgresql://baobart:baobart@localhost:5433/baobart?schema=public")).toBe(true);
    expect(baseLocale("postgresql://baobart:baobart@127.0.0.1:5433/baobart")).toBe(true);
    expect(baseLocale("postgresql://baobart:baobart@[::1]:5433/baobart")).toBe(true);
  });

  it("refuse une base distante, même quand « localhost » figure ailleurs que dans l'hôte", () => {
    // L'ancien garde-fou (`url.includes("localhost")`) les acceptait toutes les quatre.
    expect(baseLocale("postgresql://u:p@localhost.exemple.com:5432/db")).toBe(false);
    expect(baseLocale("postgresql://localhost:p@db.exemple.com:5432/db")).toBe(false);
    expect(baseLocale("postgresql://u:p@db.exemple.com:5432/db?host=localhost")).toBe(false);
    expect(baseLocale("postgresql://u:p@db.exemple.com:5432/127.0.0.1")).toBe(false);
  });

  it("refuse une adresse vide ou illisible", () => {
    expect(baseLocale("")).toBe(false);
    expect(baseLocale("localhost")).toBe(false);
  });
});
