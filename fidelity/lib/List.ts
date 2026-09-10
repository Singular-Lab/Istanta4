/**
 * Implementazione di una classe List generica simile a C#/Java
 * Fornisce un'interfaccia familiare per la gestione di collezioni
 */
export class List<T> extends Array<T> {
  constructor(...items: T[]) {
    super(...items);
    // Ripristina il prototipo corretto
    Object.setPrototypeOf(this, List.prototype);
  }

  /**
   * Aggiunge un elemento alla fine della lista
   */
  add(item: T): void {
    this.push(item);
  }

  /**
   * Aggiunge più elementi alla fine della lista
   */
  addRange(items: T[]): void {
    this.push(...items);
  }

  /**
   * Inserisce un elemento alla posizione specificata
   */
  insert(index: number, item: T): void {
    this.splice(index, 0, item);
  }

  /**
   * Rimuove la prima occorrenza dell'elemento specificato
   */
  remove(item: T): boolean {
    const index = this.indexOf(item);
    if (index !== -1) {
      this.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Rimuove l'elemento alla posizione specificata
   */
  removeAt(index: number): void {
    if (index >= 0 && index < this.length) {
      this.splice(index, 1);
    }
  }

  /**
   * Rimuove tutti gli elementi che soddisfano la condizione
   */
  removeAll(predicate: (item: T) => boolean): number {
    let removed = 0;
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i])) {
        this.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Verifica se la lista contiene l'elemento specificato
   */
  contains(item: T): boolean {
    return this.indexOf(item) !== -1;
  }

  /**
   * Restituisce il numero di elementi nella lista
   */
  get count(): number {
    return this.length;
  }

  /**
   * Verifica se la lista è vuota
   */
  get isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Svuota completamente la lista
   */
  clear(): void {
    this.splice(0, this.length);
  }

  /**
   * Restituisce il primo elemento che soddisfa la condizione
   */
  find(predicate: (item: T, index: number, array: T[]) => boolean): T | undefined {
    return super.find(predicate);
  }

  /**
   * Restituisce tutti gli elementi che soddisfano la condizione
   */
  where(predicate: (item: T) => boolean): List<T> {
    const result = new List<T>();
    result.addRange(this.filter(predicate));
    return result;
  }

  /**
   * Proietta ogni elemento in una nuova forma
   */
  select<U>(selector: (item: T) => U): List<U> {
    const result = new List<U>();
    result.addRange(this.map(selector));
    return result;
  }

  /**
   * Verifica se tutti gli elementi soddisfano la condizione
   */
  all(predicate: (item: T) => boolean): boolean {
    return this.every(predicate);
  }

  /**
   * Verifica se almeno un elemento soddisfa la condizione
   */
  any(predicate?: (item: T) => boolean): boolean {
    if (predicate) {
      return this.some(predicate);
    }
    return this.length > 0;
  }

  /**
   * Restituisce il primo elemento (lancia errore se vuota)
   */
  first(): T {
    if (this.length === 0) {
      throw new Error('La lista è vuota');
    }
    return this[0];
  }

  /**
   * Restituisce il primo elemento o undefined se vuota
   */
  firstOrDefault(): T | undefined {
    return this.length > 0 ? this[0] : undefined;
  }

  /**
   * Restituisce l'ultimo elemento (lancia errore se vuota)
   */
  last(): T {
    if (this.length === 0) {
      throw new Error('La lista è vuota');
    }
    return this[this.length - 1];
  }

  /**
   * Restituisce l'ultimo elemento o undefined se vuota
   */
  lastOrDefault(): T | undefined {
    return this.length > 0 ? this[this.length - 1] : undefined;
  }

  /**
   * Converte la lista in un array normale
   */
  toArray(): T[] {
    return [...this];
  }

  /**
   * Ordina la lista utilizzando il comparatore specificato
   */
  sortBy<K>(keySelector: (item: T) => K): List<T> {
    const sorted = [...this].sort((a, b) => {
      const keyA = keySelector(a);
      const keyB = keySelector(b);
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });

    this.clear();
    this.addRange(sorted);
    return this;
  }

  /**
   * Raggruppa gli elementi per chiave
   */
  groupBy<K>(keySelector: (item: T) => K): Map<K, List<T>> {
    const groups = new Map<K, List<T>>();

    for (const item of this) {
      const key = keySelector(item);
      if (!groups.has(key)) {
        groups.set(key, new List<T>());
      }
      groups.get(key)!.add(item);
    }

    return groups;
  }

  /**
   * Restituisce elementi distinti
   */
  distinct(): List<T> {
    const result = new List<T>();
    const seen = new Set<T>();

    for (const item of this) {
      if (!seen.has(item)) {
        seen.add(item);
        result.add(item);
      }
    }

    return result;
  }
}
