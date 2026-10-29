// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { memo, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config, DataFields, PageLayoutItem, ReferenzeIstanta } from "../../../../lib/types";

const finti = vi.hoisted(() => ({
  post: vi.fn(),
  renderCard: vi.fn(),
  gestoriMontati: 0,
}));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { post: finti.post } }));
vi.mock("@/hooks/useWebpliantParamsManager", () => ({
  useWebpliantParamsManager: () => {
    useEffect(() => {
      finti.gestoriMontati++;
    }, []);
    return {};
  },
}));
// Card finta con lo stesso memo di BoxRef: conta i render e mostra se e in wishlist
vi.mock("../BoxRef", () => ({
  default: memo(function CardFinta(props: { referenza: ReferenzeIstanta; isInWishlist?: boolean }) {
    finti.renderCard(props);
    return <div data-testid="card">{`${props.referenza.dataFields.codice_referenza}:${props.isInWishlist ? "wishlist" : "no"}`}</div>;
  }),
}));

import { GestoreParametriPresente } from "../gestoreParametri";
import GridReferenze from ".";

const referenza = (codice: string) => ({ dataFields: { codice_referenza: codice }, fotoExtra: [] }) as unknown as ReferenzeIstanta;
const item = { id: "griglia-1", type: "griglia_referenze", content: { customStyles: { color: "red" } } } as unknown as PageLayoutItem;
const config = {} as Config;
const wishlist = (...codici: string[]) => codici.map((codice_referenza) => ({ codice_referenza }) as unknown as DataFields);

afterEach(() => {
  finti.post.mockReset();
  finti.renderCard.mockReset();
  finti.gestoriMontati = 0;
});

describe("GridReferenze", () => {
  it("segna le card in wishlist e non le ridisegna se la wishlist arriva uguale in un array nuovo", async () => {
    finti.post.mockResolvedValue([referenza("r1"), referenza("r2"), referenza("r3")]);
    const { rerender } = render(
      <GestoreParametriPresente>
        <GridReferenze item={item} config={config} refsWishlist={wishlist("r2")} />
      </GestoreParametriPresente>
    );

    expect(await screen.findAllByTestId("card")).toHaveLength(3);
    expect(screen.getAllByTestId("card").map((card) => card.textContent)).toEqual(["r1:no", "r2:wishlist", "r3:no"]);
    const renderDopoCaricamento = finti.renderCard.mock.calls.length;

    rerender(
      <GestoreParametriPresente>
        <GridReferenze item={item} config={config} refsWishlist={wishlist("r2")} />
      </GestoreParametriPresente>
    );

    expect(finti.renderCard.mock.calls.length).toBe(renderDopoCaricamento);
  });

  it("sotto il layout non crea gestori dei parametri; fuori ne crea uno per tutta la griglia", async () => {
    finti.post.mockResolvedValue([referenza("r1"), referenza("r2")]);
    const sottoIlLayout = render(
      <GestoreParametriPresente>
        <GridReferenze item={item} config={config} />
      </GestoreParametriPresente>
    );
    expect(await screen.findAllByTestId("card")).toHaveLength(2);
    expect(finti.gestoriMontati).toBe(0);
    sottoIlLayout.unmount();

    render(<GridReferenze item={item} config={config} />);

    expect(await screen.findAllByTestId("card")).toHaveLength(2);
    expect(finti.gestoriMontati).toBe(1);
  });
});
