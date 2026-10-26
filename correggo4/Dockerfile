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

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS final

WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Storage__VolantiniPath=/data/volantini

# Magick.NET delegates PDF rendering to Ghostscript.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ghostscript \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=app:app /out/app/ ./
RUN mkdir -p /data/volantini \
    && chown -R app:app /data

USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Correggo4.dll"]
