-- Eseguito automaticamente al primo avvio del container PostgreSQL.
-- Deve essere il primo script (prefisso 00) per garantire che le estensioni
-- siano disponibili prima del ripristino del dump (01-restore.sh).

-- Richiesto da uuid_generate_v4() usato come defaultValue nei modelli Sequelize
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Richiesto da DataTypes.GEOMETRY (colonna geom_utenti nel modello Utente e altri)
CREATE EXTENSION IF NOT EXISTS postgis;
