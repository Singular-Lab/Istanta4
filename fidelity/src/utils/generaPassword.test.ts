import { describe, expect, it } from "vitest";
import { REGOLA_PASSWORD } from "../../lib/accessi/tipiUtenteCreabili";
import { generaPassword } from "./generaPassword";

describe("generaPassword", () => {
  it("ogni password generata rispetta la regola della password", () => {
    for (let i = 0; i < 500; i++) {
      const password = generaPassword();
      expect(password).toHaveLength(14);
      expect(REGOLA_PASSWORD.test(password)).toBe(true);
    }
  });

  it("non scende sotto gli 8 caratteri richiesti", () => {
    expect(generaPassword(4)).toHaveLength(8);
    expect(REGOLA_PASSWORD.test(generaPassword(4))).toBe(true);
  });

  it("due password generate di seguito sono diverse", () => {
    expect(generaPassword()).not.toBe(generaPassword());
  });

  it("niente caratteri che si confondono ricopiandoli", () => {
    for (let i = 0; i < 200; i++) {
      expect(generaPassword()).not.toMatch(/[lIO01]/);
    }
  });
});
