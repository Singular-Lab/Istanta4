// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Pagination from ".";

describe("Pagination", () => {
  it("aria-label di un link arriva al DOM e ne dà il nome accessibile", () => {
    render(
      <Pagination aria-label="Paginazione">
        <Pagination.Link aria-label="Pagina successiva">›</Pagination.Link>
      </Pagination>
    );

    expect(screen.getByRole("navigation", { name: "Paginazione" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pagina successiva")).toHaveTextContent("›");
  });

  it("la pagina attiva è marcata con aria-current", () => {
    render(
      <Pagination>
        <Pagination.Link>1</Pagination.Link>
        <Pagination.Link active>2</Pagination.Link>
      </Pagination>
    );

    expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("1")).not.toHaveAttribute("aria-current");
  });

  it("onClick resta collegato e l'elemento resta un link", () => {
    const onClick = vi.fn();
    render(
      <Pagination>
        <Pagination.Link onClick={onClick}>3</Pagination.Link>
      </Pagination>
    );

    const link = screen.getByText("3");
    fireEvent.click(link);

    expect(link.tagName).toBe("A");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
