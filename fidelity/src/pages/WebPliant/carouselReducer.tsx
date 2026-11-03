// reducers/carouselReducer.ts
import type { ReferenzeIstanta } from "../../../lib/types";

export interface CarouselState {
  tabs: string[];
  activeTab: string;
  referenzeGroupedBy: ReferenzeIstanta[][];
  displayNames?: string[];
}

export type CarouselAction =
  | { type: 'INIT'; payload: { referenze: ReferenzeIstanta[]; item: any } }
  | { type: 'SET_ACTIVE_TAB'; payload: string };

export function carouselReducer(
  state: CarouselState,
  action: CarouselAction
): CarouselState {
  switch (action.type) {
    case 'INIT': {
      const { referenze, item } = action.payload;
      const options = item.content?.options;
      if (!options) {
        return {
          tabs: [],
          activeTab: '',
          referenzeGroupedBy: [referenze],
        };
      }

      if (options.carouselType === 'groupedby') {
        const field = options.carouselTypeField;
        // Ottieni i valori unici del campo specificato
        const uniqueTabs = Array.from(
          new Set(referenze.map((ref: ReferenzeIstanta) => ref.dataFields[field] as string))
        );
        const grouped = uniqueTabs.map((tab: string) =>
          referenze.filter((r: ReferenzeIstanta) => r.dataFields[field] === tab)
        );
        return {
          tabs: uniqueTabs,
          displayNames: uniqueTabs,
          activeTab: uniqueTabs[0],
          referenzeGroupedBy: grouped,
        };
      } else {
        // carouselType === 'normal' o non specificato
        return {
          tabs: [],
          activeTab: '',
          referenzeGroupedBy: [referenze],
        };
      }
    }
    case 'SET_ACTIVE_TAB': {
      return {
        ...state,
        activeTab: action.payload,
      };
    }
    default:
      return state;
  }
}
