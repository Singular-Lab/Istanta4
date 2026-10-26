#!/usr/bin/env bash
# Genera i due documenti automatici della cartella documentazione:
#   04-riferimento-controller.md   dal codice dei controller
#   08b-schema-database.md         dal database
#
# Rilancialo dopo ogni modifica strutturale. Non serve niente di installato oltre a
# python3, e psql soltanto per il secondo documento.
#
#   ./genera-riferimento.sh              genera tutti e due
#   ./genera-riferimento.sh rotte        solo il primo
#   ./genera-riferimento.sh db           solo il secondo
set -uo pipefail
S=${ISTANTA_SOLUZIONE:-/srv/istanta4/soluzione}
D="$S/sorgenti/documentazione"
COSA=${1:-tutto}

if [ "$COSA" = "tutto" ] || [ "$COSA" = "rotte" ]; then
python3 - "$S" "$D" <<'PYEOF'
import os, re, sys, datetime
S, D = sys.argv[1], sys.argv[2]
C = S + "/Istanta/Controllers"

def vuota(m): return re.sub(r'[^\n]', '', m.group(0))
def nudo(t):
    t = re.sub(r'/\*.*?\*/', vuota, t, flags=re.S)
    return "\n".join(re.sub(r'//.*$', '', x) for x in t.split("\n"))
def senza_str(x):
    x = re.sub(r'@"(?:[^"]|"")*"', '""', x)
    x = re.sub(r'"(\\.|[^"\\])*"', '""', x)
    return re.sub(r"'(\\.|[^'\\])*'", "''", x)

R = []
def P(s=""): R.append(s)

P("# Riferimento dei controller e delle rotte")
P()
P("> **Questo documento e generato**, non scritto a mano. Lo produce")
P("> `strumenti/genera-riferimento.sh` leggendo `Istanta/Controllers/`.")
P("> Non modificarlo: rilancia lo script.")
P(">")
P("> Generato il %s." % datetime.datetime.now().strftime("%d/%m/%Y alle %H:%M"))
P()

file_cs = sorted(f for f in os.listdir(C) if f.endswith(".cs"))
dati = []

for f in file_cs:
    p = os.path.join(C, f)
    grezzo = open(p, encoding="utf-8", errors="replace").read().replace("\r\n", "\n")
    t = nudo(grezzo); L = t.split("\n"); LG = grezzo.split("\n")

    # Alcuni file dichiarano una classe di servizio PRIMA del controller
    # (LoginController.cs dichiara ChangePasswordAction, AuthController.cs
    # dichiara NoExternalValidator). Prendere la prima classe del file da il
    # nome sbagliato: preferisco quella che e davvero un controller.
    candidate = []
    for k, x in enumerate(L):
        m = re.match(r'\s*(?:public|internal)\s+(?:partial\s+|sealed\s+|abstract\s+)*class\s+(\w+)\s*(?::\s*([\w\s,<>]+))?', x)
        if m:
            candidate.append((m.group(1), (m.group(2) or "").strip(), k))
    if not candidate: continue
    atteso = f[:-3]                      # il nome del file senza .cs
    mc = None
    for c in candidate:                  # 1. quella che si chiama come il file
        if c[0] == atteso: mc = c; break
    if mc is None:                       # 2. quella che finisce per Controller
        for c in candidate:
            if c[0].endswith("Controller"): mc = c; break
    if mc is None:                       # 3. quella che eredita da un Controller
        for c in candidate:
            if "Controller" in c[1]: mc = c; break
    if mc is None: mc = candidate[0]     # 4. e se no, la prima
    nome_cls, base, k_cls = mc
    # se la classe scelta non e un controller, il file non ne contiene uno:
    # succede per AuthController.cs, che ha solo IExternalUserValidator e le
    # sue implementazioni. Meglio dirlo che far finta.
    non_e_controller = not (nome_cls.endswith("Controller") or "Controller" in base)

    att_cls = []
    j = k_cls - 1
    while j >= 0 and (LG[j].strip().startswith("[") or LG[j].strip().startswith("//") or not LG[j].strip()):
        if LG[j].strip().startswith("["): att_cls.insert(0, LG[j].strip())
        j -= 1

    dip = []
    for k, x in enumerate(L):
        if re.match(r'\s*public\s+' + re.escape(nome_cls) + r'\s*\(', x):
            testo = x; kk = k
            while testo.count("(") > testo.count(")") and kk + 1 < len(L):
                kk += 1; testo += " " + L[kk].strip()
            dentro = testo[testo.index("(") + 1: testo.rindex(")")] if ")" in testo else ""
            for par in re.split(r',(?![^<>]*>)', dentro):
                if par.strip(): dip.append(par.strip())
            break

    azioni = []
    for k, x in enumerate(L):
        m = re.match(r'\s*public\s+(?:static\s+|async\s+|virtual\s+|override\s+)*'
                     r'((?:Task<)?[A-Za-z_][\w<>,\[\]\?\.\s]*?)\s+([A-Za-z_]\w*)\s*\(', x)
        if not m: continue
        ritorno, nome = m.group(1).strip(), m.group(2)
        if nome == nome_cls or nome in ("if","for","foreach","while","switch","return","get","set"): continue
        att = []
        j = k - 1
        while j >= 0 and (LG[j].strip().startswith("[") or LG[j].strip().startswith("//")
                          or LG[j].strip().startswith("///") or not LG[j].strip()):
            if LG[j].strip().startswith("["): att.insert(0, LG[j].strip())
            j -= 1
        liv = 0; kk = k; visto = False
        while kk < len(L):
            s = senza_str(L[kk]); liv += s.count("{") - s.count("}")
            if "{" in s: visto = True
            if visto and liv <= 0: break
            kk += 1
        lung = (kk - k + 1) if (visto and liv <= 0) else -1
        corpo = "\n".join(L[k:kk+1]) if lung > 0 else ""
        firma = x.strip(); j2 = k
        while firma.count("(") > firma.count(")") and j2 + 1 < len(L):
            j2 += 1; firma += " " + L[j2].strip()
        viste = sorted(set(re.findall(r'View\(\s*"([^"]+)"', corpo)))
        if re.search(r'\breturn\s+View\(\s*\)', corpo): viste.append("(omonima)")
        lib = sorted(set(re.findall(r'execLibFunction\(\s*\$?"([^"]+)"', corpo)))
        lib_var = len(re.findall(r'execLibFunction\(\s*(?!\$?")', corpo))
        http = sorted(set(re.findall(r'(fpUrl|olUrl|olympusServerUrl|olimpoIp|correggoServerUrl)', corpo)))
        ctx = sorted(set(re.findall(r'\bthis\.(ctx2|ctx)\b', corpo)))
        azioni.append(dict(riga=k+1, nome=nome, ritorno=ritorno, att=att, lung=lung,
                           firma=re.sub(r'\s+', ' ', firma), viste=viste, lib=lib,
                           lib_var=lib_var, http=http, ctx=ctx))
    dati.append(dict(file=f, cls=nome_cls, base=base, righe=len(LG),
                     att_cls=att_cls, dip=dip, azioni=azioni,
                     non_e_controller=non_e_controller))

P("## Indice")
P()
P("| controller | righe | azioni | contesti db | AgenziaLib | servizi esterni |")
P("|---|---:|---:|---|---|---|")
for d in sorted(dati, key=lambda x: -x["righe"]):
    ctx = sorted(set(c for a in d["azioni"] for c in a["ctx"]))
    lib = sum(len(a["lib"]) + a["lib_var"] for a in d["azioni"])
    http = sorted(set(h for a in d["azioni"] for h in a["http"]))
    etichetta = d["cls"] + (" *(non e un controller)*" if d["non_e_controller"] else "")
    P("| [%s](#%s) | %d | %d | %s | %s | %s |" % (
        etichetta, d["cls"].lower(), d["righe"], len(d["azioni"]),
        ", ".join(ctx) or "—", (str(lib) if lib else "—"), ", ".join(http) or "—"))
P()
P("**Totale: %d controller, %d azioni pubbliche, %d righe.**" % (
    len(dati), sum(len(d["azioni"]) for d in dati), sum(d["righe"] for d in dati)))
P()
P("Legenda delle colonne:")
P()
P("- **contesti db**: `ctx` e il contesto anagrafico (`edro21_dbContext`), `ctx2` quello delle promozioni (`Edro21_DbContext2`)")
P("- **AgenziaLib**: quante chiamate per riflessione partono da questo controller")
P("- **servizi esterni**: quali indirizzi configurati usa")
P()
P("---")

for d in sorted(dati, key=lambda x: x["cls"]):
    P()
    P("## %s" % d["cls"])
    P()
    P("`Istanta/Controllers/%s` — %d righe, %d azioni pubbliche." % (d["file"], d["righe"], len(d["azioni"])))
    if d["base"]: P(" Eredita da `%s`." % d["base"])
    P()
    if d["non_e_controller"]:
        P("> **Questo file non contiene un controller.** La classe qui sopra e la prima")
        P("> dichiarata nel file, ma non eredita da `Controller` e non si chiama come il")
        P("> file. Le \"azioni\" elencate sono metodi pubblici ordinari, non rotte HTTP.")
        P()
    for a in d["att_cls"]: P("Attributo di classe: `%s`" % a)
    if d["att_cls"]: P()
    if d["dip"]:
        P("**Dipendenze iniettate** (%d):" % len(d["dip"]))
        P()
        for x in d["dip"]: P("- `%s`" % x)
        P()
    if not d["azioni"]:
        P("*Nessuna azione pubblica.*"); continue
    P("| azione | riga | righe | rotta | ritorna | vista | AgenziaLib | db |")
    P("|---|---:|---:|---|---|---|---|---|")
    for a in sorted(d["azioni"], key=lambda x: x["riga"]):
        rotte = [x for x in a["att"] if re.search(r'Http(Get|Post|Put|Delete|Patch)|Route|NonAction|AllowAnonymous|Authorize', x)]
        rotta = "<br>".join("`%s`" % x for x in rotte) if rotte else "—"
        lib = ", ".join("`%s`" % x.split(".")[-1] for x in a["lib"])
        if a["lib_var"]: lib += (", " if lib else "") + "%d a runtime" % a["lib_var"]
        P("| **%s** | %d | %s | %s | `%s` | %s | %s | %s |" % (
            a["nome"], a["riga"], (a["lung"] if a["lung"] > 0 else "?"), rotta,
            a["ritorno"][:40], ", ".join(a["viste"]) or "—", lib or "—",
            ", ".join(a["ctx"]) or "—"))
    P()

open(D + "/04-riferimento-controller.md", "w", encoding="utf-8").write("\n".join(R) + "\n")
print("    scritto 04-riferimento-controller.md (%d righe)" % len(R))
PYEOF
fi

if [ "$COSA" = "tutto" ] || [ "$COSA" = "db" ]; then
python3 - "$S" "$D" <<'PYEOF'
import os, sys, subprocess, datetime
S, D = sys.argv[1], sys.argv[2]

s = ""
for percorso in ("/etc/istanta4-pgtest.env",):
    if not os.path.exists(percorso): continue
    for r in open(percorso, encoding="utf-8", errors="replace"):
        if r.startswith("ConnectionStrings__IstandaConnectionDb="):
            s = r.split("=", 1)[1].strip().strip('"')
if not s:
    try:
        import json
        d = json.load(open(S + "/pubblicato/appsettings.json", encoding="utf-8-sig"))
        s = d.get("ConnectionStrings", {}).get("IstandaConnectionDb", "")
    except Exception: pass
q = {}
for kv in s.split(";"):
    if "=" in kv:
        k, v = kv.split("=", 1); q[k.strip().lower()] = v.strip()
if not q:
    print("    db: nessuna stringa di connessione, salto 08b"); raise SystemExit

env = dict(os.environ); env["PGPASSWORD"] = q.get("password", "")
base = ["psql", "-h", q.get("host", "127.0.0.1"), "-p", str(q.get("port", "5432")),
        "-U", q.get("username", "istanta"), "-d", q.get("database", "istanta4_pg"),
        "-t", "-A", "-F", "|", "-c"]
def sql(t, timeout=90):
    try:
        r = subprocess.run(base + [t], env=env, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0: return None
        return [x for x in r.stdout.strip().split("\n") if x.strip()]
    except Exception: return None

v = sql("select version()")
if not v:
    print("    db non raggiungibile, salto 08b"); raise SystemExit

R = []
def P(x=""): R.append(x)
P("# Schema del database")
P()
P("> **Questo documento e generato**, non scritto a mano. Lo produce")
P("> `strumenti/genera-riferimento.sh` interrogando il database configurato in")
P("> `/etc/istanta4-pgtest.env`. Non modificarlo: rilancia lo script.")
P(">")
P("> Generato il %s, su `%s`." % (datetime.datetime.now().strftime("%d/%m/%Y alle %H:%M"),
                                  q.get("database", "?")))
P(">")
P("> **Nessuna credenziale compare in questo file.**")
P()
P("`%s`" % v[0][:90])
P()
P("---")
P()
P("## Le tabelle")
P()
r = sql("select relname||'|'||n_live_tup from pg_stat_user_tables where schemaname='public' order by relname")
if r:
    P("| tabella | righe |")
    P("|---|---:|")
    for x in r:
        t, n = x.split("|"); P("| `%s` | %s |" % (t, n))
    P()
    P("**%d tabelle.**" % len(r))
    P()
    P("> Il database demo e quasi vuoto: i numeri qui sopra non dicono niente sulla produzione.")
P()
P("---")
P()
P("## Le colonne")
P()
r = sql("""select table_name||'|'||column_name||'|'||data_type||'|'||is_nullable||'|'||coalesce(column_default,'')
           from information_schema.columns where table_schema='public'
           order by table_name, ordinal_position""")
if r:
    cor = None
    for x in r:
        p = x.split("|")
        if p[0] != cor:
            cor = p[0]
            P(); P("### `%s`" % cor); P()
            P("| colonna | tipo | null | default |")
            P("|---|---|---|---|")
        P("| `%s` | %s | %s | %s |" % (p[1], p[2], "si" if p[3] == "YES" else "**NO**",
                                       ("`%s`" % p[4][:40]) if p[4] else ""))
P()
P("---")
P()
P("## Chiavi primarie e chiavi esterne")
P()
r = sql("""select tc.table_name||'|'||tc.constraint_type||'|'||kcu.column_name||'|'||
                  coalesce(ccu.table_name,'')||'.'||coalesce(ccu.column_name,'')
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name
           left join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
           where tc.table_schema='public' and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY')
           order by tc.table_name, tc.constraint_type""")
if r:
    P("| tabella | vincolo | colonna | riferisce |")
    P("|---|---|---|---|")
    for x in r:
        p = x.split("|")
        P("| `%s` | %s | `%s` | `%s` |" % (p[0], p[1], p[2], p[3]))
P()
P("---")
P()
P("## Indici")
P()
r = sql("select tablename||'|'||indexname||'|'||indexdef from pg_indexes where schemaname='public' order by tablename, indexname")
if r:
    P("| tabella | indice | definizione |")
    P("|---|---|---|")
    for x in r:
        p = x.split("|", 2)
        P("| `%s` | `%s` | `%s` |" % (p[0], p[1], p[2][:120]))
open(D + "/08b-schema-database.md", "w", encoding="utf-8").write("\n".join(R) + "\n")
print("    scritto 08b-schema-database.md (%d righe)" % len(R))
PYEOF
fi
