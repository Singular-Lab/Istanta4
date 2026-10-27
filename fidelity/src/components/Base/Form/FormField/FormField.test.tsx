// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FormField from ".";
import FormInput from "../FormInput";

describe("FormField", () => {
  it("collega etichetta e campo", () => {
    render(
      <FormField etichetta="Nome">
        <FormInput />
      </FormField>
    );

    const campo = screen.getByLabelText("Nome");
    expect(campo.tagName).toBe("INPUT");
    expect(campo).not.toHaveAttribute("aria-invalid");
    expect(campo).not.toHaveAttribute("aria-describedby");
  });

  it("rispetta l'id già impostato sul campo", () => {
    render(
      <FormField etichetta="Email">
        <FormInput id="email_utente" />
      </FormField>
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email_utente");
  });

  it("aiuto ed errore descrivono il campo, che risulta non valido", () => {
    render(
      <FormField etichetta="URL" aiuto="Deve iniziare con https://" errore="URL non valido">
        <FormInput id="url" />
      </FormField>
    );

    const campo = screen.getByLabelText("URL");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAttribute("aria-describedby", "url-aiuto url-errore");
    expect(campo).toHaveAccessibleDescription("Deve iniziare con https:// URL non valido");
  });

  it("un campo obbligatorio ha l'asterisco e lo annuncia", () => {
    render(
      <FormField etichetta="Nome" obbligatorio>
        <FormInput />
      </FormField>
    );

    // Il nome accessibile esclude l'asterisco aria-hidden; getByLabelText leggerebbe "Nome* (obbligatorio)"
    const campo = screen.getByRole("textbox", { name: "Nome (obbligatorio)" });
    expect(campo).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });
});
