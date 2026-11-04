# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build

WORKDIR /src
COPY app/Correggo4/Correggo4.csproj app/Correggo4/
RUN dotnet restore app/Correggo4/Correggo4.csproj

COPY app/Correggo4/ app/Correggo4/
RUN dotnet publish app/Correggo4/Correggo4.csproj \
    -c Release \
    --no-restore \
    -o /out/app \
    /p:UseAppHost=false

# The timone report PDF (Servizi/ServizioPdf.cs) is printed by chrome-headless-shell
# from Chrome for Testing: pinned version, verified archive.
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS chrome
ARG CHROME_PDF_VERSION=157.0.8103.38
ARG CHROME_PDF_SHA256=deafffa74660b34853a4119c361fd427ac8c9fcb62db51ddb8a797cd83a4ba2d
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /tmp/chrome-pdf.zip \
       "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_PDF_VERSION}/linux64/chrome-headless-shell-linux64.zip" \
    && echo "${CHROME_PDF_SHA256}  /tmp/chrome-pdf.zip" | sha256sum -c - \
    && unzip -q /tmp/chrome-pdf.zip -d /tmp \
    && mv /tmp/chrome-headless-shell-linux64 /opt/chrome-pdf \
    && rm /tmp/chrome-pdf.zip

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS final

WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Storage__VolantiniPath=/data/volantini

# Magick.NET delegates PDF rendering to Ghostscript.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ghostscript \
    && rm -rf /var/lib/apt/lists/*

# chrome-headless-shell: the libraries it links against and the fonts the report is
# written with, then a one-line print so a missing library fails the build, not the
# first export.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       fontconfig fonts-liberation fonts-dejavu-core \
       libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
       libdbus-1-3 libexpat1 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libudev1 \
       libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
       libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=chrome /opt/chrome-pdf/ /opt/chrome-pdf/
RUN ln -s /opt/chrome-pdf/chrome-headless-shell /usr/local/bin/chrome-pdf \
    && printf '<!doctype html><meta charset="utf-8"><p>Report timone: prova</p>' > /tmp/prova.html \
    && chrome-pdf --headless --disable-gpu --no-sandbox --disable-dev-shm-usage \
       --user-data-dir=/tmp/prova-profilo "--host-resolver-rules=MAP * ~NOTFOUND" \
       --no-pdf-header-footer --print-to-pdf=/tmp/prova.pdf /tmp/prova.html \
    && head -c 4 /tmp/prova.pdf | grep -q '%PDF' \
    && rm -rf /tmp/prova.html /tmp/prova.pdf /tmp/prova-profilo

COPY --from=build --chown=app:app /out/app/ ./
RUN mkdir -p /data/volantini \
    && chown -R app:app /data

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Correggo4.dll"]
