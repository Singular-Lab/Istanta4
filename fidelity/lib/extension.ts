// global-extensions.d.ts
// Estensioni utili ai tipi standard di TypeScript
// IMPORTANT: aggiungi questo file al progetto (es. via "include" in tsconfig.json) per abilitare le estensioni globali.

export {};

declare global {
  //////////////////////////
  // String extensions  //
  //////////////////////////
  /**
   * Restituisce la stringa con la prima lettera in maiuscolo.
   * @example "ciao mondo".capitalize() // => "Ciao mondo"
   */
  interface String {
    capitalize(): string;

    /**
     * Converte stringhe con spazi, underscore o trattini in camelCase.
     * @example "hello-world_example test".toCamelCase() // => "helloWorldExampleTest"
     */
    toCamelCase(): string;

    /**
     * Converte in Title Case: prima lettera di ogni parola maiuscola, resto minuscolo.
     * @example "ESTERNO DONNA".toTitleCase() // => "Esterno Donna"
     */
    toTitleCase(): string;

    /**
     * Converte camelCase o spazi in kebab-case.
     * @example "HelloWorld Test".toKebabCase() // => "hello-world-test"
     */
    toKebabCase(): string;

    /**
     * Inverte l'ordine dei caratteri.
     * @example "abcde".reverse() // => "edcba"
     */
    reverse(): string;
  }

  //////////////////////////
  // Number extensions  //
  //////////////////////////
  interface Number {
    /**
     * Limita il valore nel range [min, max].
     * @example (10).clamp(0,5)  // => 5
     * @example (-3).clamp(0,5)  // => 0
     */
    clamp(min: number, max: number): number;

    /**
     * Restituisce true se il numero è pari.
     * @example (4).isEven()  // => true
     */
    isEven(): boolean;

    /**
     * Restituisce true se il numero è dispari.
     * @example (5).isOdd()   // => true
     */
    isOdd(): boolean;
  }

  //////////////////////////
  // Array extensions   //
  //////////////////////////
  interface Array<T> {
    /**
     * Suddivide l'array in sottogruppi di lunghezza `size`.
     * @example [1,2,3,4,5].chunk(2) // => [[1,2],[3,4],[5]]
     */
    chunk(size: number): T[][];

    /**
     * Restituisce un nuovo array senza duplicati (confronto tramite ===).
     * @example [1,2,2,3].unique()   // => [1,2,3]
     * @example ['a','b','a'].unique() // => ['a','b']
     * @returns {T[]} Un nuovo array contenente solo i valori unici.
     */
    unique(this: T[]): T[];

    /**
     * Appiattisce l'array fino alla profondità `depth` (default 1).
     * @example [1,[2,[3]]].flatten()      // => [1,2,[3]]
     * @example [1,[2,[3]]].flatten(2)     // => [1,2,3]
     */
    flatten(depth?: number): any[];

    /**
     * Raggruppa elementi secondo la chiave restituita da `fn`.
     * @example [{age:20},{age:30},{age:20}].groupBy(x=>x.age)
     * @example { '20': [{age:20},{age:20}], '30': [{age:30}] }
     */
    groupBy<K extends PropertyKey>(keyFn: (item: T) => K): Record<K, T[]>;
  }


  //////////////////////////
  // Promise extensions //
  //////////////////////////
  interface Promise<T> {
    /**
     * Ritarda la risoluzione per `ms` millisecondi.
     * @example Promise.resolve(1).delay(1000).then(console.log) // dopo 1s => 1
     */
    delay(ms: number): Promise<T>;
  }

  //////////////////////////
  // Boolean extensions //
  //////////////////////////
  interface Boolean {
    /**
     * Inverte il valore.
     * @example true.toggle()  // => false
     */
    toggle(): boolean;

    /**
     * Converte in 1 o 0.
     * @example false.toNumber() // => 0
     */
    toNumber(): number;
  }

  //////////////////////////
  // Date extensions    //
  //////////////////////////
  interface Date {
    /**
     * Aggiunge `days` giorni.
     * @example new Date('2025-07-01').addDays(5)
     * @example // => 2025-07-06T...
     */
    addDays(days: number): Date;

    /**
     * Aggiunge `months` mesi.
     */
    addMonths(months: number): Date;

    /**
     * Formatta usando token YYYY, MM, DD, hh, mm, ss.
     * @example new Date('2025-07-01T08:05:09').format('YYYY-MM-DD hh:mm')
     * @example // => "2025-07-01 08:05"
     */
    format(fmt: string): string;

    /**
     * Verifica se è sabato o domenica.
     */
    isWeekend(): boolean;

    /**
     * Differenza intera in giorni tra due date.
     */
    diffInDays(other: Date): number;
  }

  //////////////////////////
  // RegExp extensions  //
  //////////////////////////
  interface RegExp {
    /**
     * Esegue exec globale e restituisce tutte le occorrenze.
     */
    execAll(str: string): RegExpExecArray[];
  }

  //////////////////////////
  // Map extensions    //
  //////////////////////////
  interface Map<K, V> {
    /**
     * Trasforma i valori, mantiene le chiavi.
     */
    mapValues<U>(fn: (value: V, key: K, map: Map<K, V>) => U): Map<K, U>;

    /**
     * Filtra coppie chiave/valore.
     */
    filter(fn: (value: V, key: K, map: Map<K, V>) => boolean): Map<K, V>;

    /**
     * Converte in oggetto con chiavi string.
     */
    toObject(): Record<string, V>;
  }

  //////////////////////////
  // Set extensions    //
  //////////////////////////
  interface Set<T> {
    /**
     * Unione di due insiemi.
     */
    union(other: Set<T>): Set<T>;

    /**
     * Elementi presenti in entrambi.
     */
    intersection(other: Set<T>): Set<T>;

    /**
     * Elementi nel primo non nel secondo.
     */
    difference(other: Set<T>): Set<T>;
  }

  //////////////////////////
  // Function extensions //
  //////////////////////////
  interface Function {
    /**
     * Ritorna una versione debounce.
     * @example const fn = () => console.log('hi');
     * @example window.addEventListener('resize', fn.debounce(200));
     */
    debounce(ms: number, immediate?: boolean): any;

    /**
     * Ritorna una versione throttle.
     * @example element.onscroll = handler.throttle(100);
     */
    throttle(ms: number): any;
  }
}

// ------------------------------
// Implementazioni: importa o includi questo file per applicare le estensioni globali.

// String
String.prototype.capitalize = function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};
String.prototype.toCamelCase = function () {
  return this.toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
};
String.prototype.toTitleCase = function () {
  return this.toLowerCase().replace(/(^|[\s\-_])(\S)/g, (_, sep, c) => sep + c.toUpperCase());
};
String.prototype.toKebabCase = function () {
  return this
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
};
String.prototype.reverse = function () {
  return this.split('').reverse().join('');
};

// Number
Number.prototype.clamp = function (min: number, max: number) {
  return Math.min(Math.max(this.valueOf(), min), max);
};
Number.prototype.isEven = function () {
  return this.valueOf() % 2 === 0;
};
Number.prototype.isOdd = function () {
  return this.valueOf() % 2 !== 0;
};

// Array
Array.prototype.chunk = function <T>(this: T[], size: number) {
  const res: T[][] = [];
  for (let i = 0; i < this.length; i += size) {
    res.push(this.slice(i, i + size));
  }
  return res;
};


Array.prototype.unique = function <T>(this: T[]): T[] {
  return Array.from(new Set(this));
};
Array.prototype.flatten = function (this: any[], depth: number = 1) {
  return depth > 0
    ? this.reduce(
        (acc, val) => acc.concat(Array.isArray(val) ? val.flatten(depth - 1) : val),
        [] as any[],
      )
    : this.slice();
};
Array.prototype.groupBy = function <T, K extends PropertyKey>(
  this: T[],
  fn: (item: T) => K,
) {
  return this.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
};

// Object utilities (standalone — Object.prototype non si estende per evitare
// collisioni con librerie che enumerano le proprietà di tutti gli oggetti)
export function mapValues<V, U>(obj: Record<string, V>, fn: (value: V, key: string) => U): Record<string, U> {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    acc[k] = fn(v, k);
    return acc;
  }, {} as Record<string, U>);
}
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const val = (obj as Record<string, unknown>)[name];
    if (val && typeof val === 'object') deepFreeze(val as object);
  });
  return Object.freeze(obj);
}

// Promise
Promise.prototype.delay = function <T>(
  this: Promise<T>,
  ms: number,
) {
  return this.then(
    (v) => new Promise<T>((res) => setTimeout(() => res(v), ms)),
    (e) => new Promise<T>((_, rej) => setTimeout(() => rej(e), ms)),
  );
};

// Boolean
Boolean.prototype.toggle = function () {
  return !this.valueOf();
};
Boolean.prototype.toNumber = function () {
  return this.valueOf() ? 1 : 0;
};

// Date
Date.prototype.addDays = function (days: number) {
  const d = new Date(this);
  d.setDate(d.getDate() + days);
  return d;
};
Date.prototype.addMonths = function (months: number) {
  const d = new Date(this);
  d.setMonth(d.getMonth() + months);
  return d;
};
Date.prototype.format = function (fmt: string) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const map: Record<string, any> = {
    YYYY: this.getFullYear(),
    MM: pad(this.getMonth() + 1),
    DD: pad(this.getDate()),
    hh: pad(this.getHours()),
    mm: pad(this.getMinutes()),
    ss: pad(this.getSeconds()),
  };
  return fmt.replace(/YYYY|MM|DD|hh|mm|ss/g, (t) => map[t]);
};
Date.prototype.isWeekend = function () {
  const d = this.getDay();
  return d === 0 || d === 6;
};
Date.prototype.diffInDays = function (other: Date) {
  const diff = this.getTime() - other.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// RegExp
RegExp.prototype.execAll = function (str: string) {
  const arr: RegExpExecArray[] = [];
  const re = new RegExp(this.source, this.flags);
  let m;
  while ((m = re.exec(str)) !== null) {
    arr.push(m);
    if (!re.global) break;
  }
  return arr;
};

// Map
Map.prototype.mapValues = function <K, V, U>(
  this: Map<K, V>,
  fn: (v: V, k: K, m: Map<K, V>) => U,
) {
  const m2 = new Map<K, U>();
  this.forEach((v, k) => m2.set(k, fn(v, k, this)));
  return m2;
};
Map.prototype.filter = function <K, V>(
  this: Map<K, V>,
  fn: (v: V, k: K, m: Map<K, V>) => boolean,
) {
  const m2 = new Map<K, V>();
  this.forEach((v, k) => fn(v, k, this) && m2.set(k, v));
  return m2;
};
Map.prototype.toObject = function <K extends string, V>(
  this: Map<K, V>,
) {
  const o = {} as Record<string, V>;
  this.forEach((v, k) => (o[k] = v));
  return o;
};

// Set
Set.prototype.union = function <T>(
  this: Set<T>,
  other: Set<T>,
) {
  const s = new Set(this);
  other.forEach((v) => s.add(v));
  return s;
};
Set.prototype.intersection = function <T>(
  this: Set<T>,
  other: Set<T>,
) {
  const s = new Set<T>();
  this.forEach((v) => other.has(v) && s.add(v));
  return s;
};
Set.prototype.difference = function <T>(
  this: Set<T>,
  other: Set<T>,
) {
  const s = new Set<T>();
  this.forEach((v) => !other.has(v) && s.add(v));
  return s;
};

// Function
Function.prototype.debounce = function (ms: number, immediate?: boolean) {
  let t: ReturnType<typeof setTimeout> | null;
  const fn = this;
  return function (this: any, ...a: any[]) {
    const callNow = immediate && !t;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      if (!immediate) fn.apply(this, a);
    }, ms);
    if (callNow) fn.apply(this, a);
  };
};
Function.prototype.throttle = function (ms: number) {
  let last = 0;
  const fn = this;
  return function (this: any, ...a: any[]) {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, a);
    }
  };
};
